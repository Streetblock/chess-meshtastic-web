const PV2 = 2;
const ALLOWED_TYPES = new Set([
  'HELLO',
  'COMMIT',
  'REVEAL',
  'START',
  'ACK',
  'MOVE',
  'SYNC',
  'RESYNC'
]);

function randomHex(bytes) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '').trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error('Invalid hex input');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return out;
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function createPv2Context() {
  return {
    enabled: false,
    protocolVersion: PV2,
    sid: randomHex(16),
    seq: 1,
    localCaps: ['c960', 'commit-reveal', 'hmac', 'fen-hash'],
    remoteCaps: [],
    peerSeqByNode: new Map(),
    state: 'idle',
    commitRound: null
  };
}

export function resetPv2Context(ctx) {
  ctx.enabled = false;
  ctx.sid = randomHex(16);
  ctx.seq = 1;
  ctx.remoteCaps = [];
  ctx.peerSeqByNode.clear();
  ctx.state = 'idle';
  ctx.commitRound = null;
}

export function nextPv2Seq(ctx) {
  const current = ctx.seq >>> 0;
  ctx.seq = (current + 1) >>> 0;
  return current === 0 ? 1 : current;
}

export function buildPv2Envelope(ctx, type, body = {}) {
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(`Unsupported pv2 type: ${type}`);
  }
  return {
    pv: PV2,
    t: type,
    sid: ctx.sid,
    seq: nextPv2Seq(ctx),
    ts: Date.now(),
    ...body
  };
}

export function isPv2Message(msg) {
  return !!msg && msg.pv === PV2 && typeof msg.t === 'string' && ALLOWED_TYPES.has(msg.t);
}

export function validatePv2Message(msg) {
  if (!isPv2Message(msg)) return { ok: false, reason: 'not-pv2' };
  if (typeof msg.sid !== 'string' || msg.sid.length < 16) {
    return { ok: false, reason: 'bad-sid' };
  }
  if (typeof msg.seq !== 'number' || !Number.isFinite(msg.seq) || msg.seq <= 0) {
    return { ok: false, reason: 'bad-seq' };
  }
  if (typeof msg.ts !== 'number' || !Number.isFinite(msg.ts)) {
    return { ok: false, reason: 'bad-ts' };
  }
  return { ok: true };
}

export function isReplayOrOutOfOrder(ctx, msg, fromNode) {
  if (fromNode == null) return false;
  const key = fromNode >>> 0;
  const previous = ctx.peerSeqByNode.get(key) ?? 0;
  if (msg.seq <= previous) return true;
  ctx.peerSeqByNode.set(key, msg.seq >>> 0);
  return false;
}

export function buildHelloMessage(ctx) {
  return buildPv2Envelope(ctx, 'HELLO', {
    caps: [...ctx.localCaps]
  });
}

export function applyRemoteHello(ctx, msg) {
  if (!msg || msg.t !== 'HELLO') return { ok: false, reason: 'not-hello' };
  const caps = Array.isArray(msg.caps) ? msg.caps.filter((x) => typeof x === 'string') : [];
  ctx.enabled = true;
  ctx.remoteCaps = caps;
  ctx.state = 'hello-received';
  return { ok: true, remoteCaps: caps };
}

export function canUseCommitReveal(ctx) {
  return ctx.enabled && ctx.remoteCaps.includes('commit-reveal');
}

export async function beginCommitRound(ctx, options = {}) {
  const cid = options.cid || `round-${Date.now()}`;
  const nonceHex = randomHex(32);
  const commit = await sha256Hex(`c960-commit-v1|${ctx.sid}|${cid}|${nonceHex}`);

  ctx.commitRound = {
    cid,
    localNonceHex: nonceHex,
    localCommit: commit,
    remoteCommit: null,
    remoteNonceHex: null,
    revealedLocal: false,
    revealedRemote: false
  };
  ctx.state = 'commit-sent';

  return buildPv2Envelope(ctx, 'COMMIT', { cid, commit });
}

export function applyRemoteCommit(ctx, msg) {
  if (!msg || msg.t !== 'COMMIT') return { ok: false, reason: 'not-commit' };
  if (typeof msg.cid !== 'string' || typeof msg.commit !== 'string') {
    return { ok: false, reason: 'bad-commit-fields' };
  }
  if (!ctx.commitRound) {
    ctx.commitRound = {
      cid: msg.cid,
      localNonceHex: null,
      localCommit: null,
      remoteCommit: msg.commit,
      remoteNonceHex: null,
      revealedLocal: false,
      revealedRemote: false
    };
  } else {
    ctx.commitRound.remoteCommit = msg.commit;
  }
  ctx.state = 'commit-received';
  return { ok: true };
}

export function shouldSendReveal(ctx) {
  return !!(ctx.commitRound && ctx.commitRound.localNonceHex && ctx.commitRound.remoteCommit && !ctx.commitRound.revealedLocal);
}

export function buildRevealMessage(ctx) {
  if (!ctx.commitRound || !ctx.commitRound.localNonceHex) {
    throw new Error('commit round not initialized');
  }
  ctx.commitRound.revealedLocal = true;
  ctx.state = 'reveal-sent';
  return buildPv2Envelope(ctx, 'REVEAL', {
    cid: ctx.commitRound.cid,
    nonce: ctx.commitRound.localNonceHex
  });
}

export async function applyRemoteReveal(ctx, msg) {
  if (!msg || msg.t !== 'REVEAL') return { ok: false, reason: 'not-reveal' };
  if (!ctx.commitRound || typeof msg.cid !== 'string' || msg.cid !== ctx.commitRound.cid) {
    return { ok: false, reason: 'cid-mismatch' };
  }
  if (typeof msg.nonce !== 'string') return { ok: false, reason: 'bad-reveal-fields' };
  if (!ctx.commitRound.remoteCommit) return { ok: false, reason: 'missing-remote-commit' };

  try {
    hexToBytes(msg.nonce);
  } catch (_) {
    return { ok: false, reason: 'bad-reveal-hex' };
  }

  const expected = await sha256Hex(`c960-commit-v1|${ctx.sid}|${ctx.commitRound.cid}|${msg.nonce}`);
  if (expected !== ctx.commitRound.remoteCommit) {
    return { ok: false, reason: 'commit-mismatch' };
  }

  ctx.commitRound.remoteNonceHex = msg.nonce;
  ctx.commitRound.revealedRemote = true;
  ctx.state = 'reveal-received';
  return { ok: true };
}

export function isCommitRoundReady(ctx) {
  return !!(
    ctx.commitRound &&
    ctx.commitRound.revealedLocal &&
    ctx.commitRound.revealedRemote &&
    ctx.commitRound.localNonceHex &&
    ctx.commitRound.remoteNonceHex
  );
}
