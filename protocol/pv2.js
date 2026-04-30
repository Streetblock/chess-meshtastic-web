import { buildChess960StartFen } from './chess960.js';

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

async function sha256Bytes(data) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function concatBytes(...chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeys(item));
  }
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value).sort();
  const out = {};
  for (const key of keys) {
    out[key] = sortObjectKeys(value[key]);
  }
  return out;
}

export function canonicalizeForMac(message) {
  const clone = { ...message };
  delete clone.mac;
  return JSON.stringify(sortObjectKeys(clone));
}

async function importHmacKey(rawKey) {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function computeMessageMac(rawKeyBytes, message) {
  const key = await importHmacKey(rawKeyBytes);
  const canonical = canonicalizeForMac(message);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical));
  return bytesToHex(new Uint8Array(sig));
}

export async function verifyMessageMac(rawKeyBytes, message) {
  if (!message || typeof message.mac !== 'string' || message.mac.length < 16) return false;
  const expected = await computeMessageMac(rawKeyBytes, message);
  return expected === message.mac;
}

async function hkdfSha256(ikmBytes, saltBytes, infoBytes, outLen = 32) {
  const baseKey = await crypto.subtle.importKey('raw', ikmBytes, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: saltBytes,
      info: infoBytes
    },
    baseKey,
    outLen * 8
  );
  return new Uint8Array(bits);
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
    commitRound: null,
    startProposal: null,
    auth: {
      enabled: false,
      keyBytes: null
    }
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
  ctx.startProposal = null;
  ctx.auth = {
    enabled: false,
    keyBytes: null
  };
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
  const envelope = {
    pv: PV2,
    t: type,
    sid: ctx.sid,
    seq: nextPv2Seq(ctx),
    ts: Date.now(),
    ...body
  };
  if (ctx.auth.enabled) {
    envelope.mac = body.mac || '';
  }
  return envelope;
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

export async function deriveUnbiasedStartId(ctx) {
  if (!isCommitRoundReady(ctx)) {
    throw new Error('commit round is not ready');
  }

  const noncePair = [ctx.commitRound.localNonceHex, ctx.commitRound.remoteNonceHex].sort();
  const sidBytes = new TextEncoder().encode(ctx.sid);
  const cidBytes = new TextEncoder().encode(ctx.commitRound.cid);
  const nonceA = hexToBytes(noncePair[0]);
  const nonceB = hexToBytes(noncePair[1]);
  const domain = new TextEncoder().encode('c960-seed-v1');
  const base = concatBytes(domain, sidBytes, cidBytes, nonceA, nonceB);

  let stream = await sha256Bytes(base);
  let offset = 0;
  let counter = 0;

  while (true) {
    if (offset + 2 > stream.length) {
      counter += 1;
      const counterBytes = new Uint8Array([
        (counter >>> 24) & 0xff,
        (counter >>> 16) & 0xff,
        (counter >>> 8) & 0xff,
        counter & 0xff
      ]);
      stream = await sha256Bytes(concatBytes(base, counterBytes));
      offset = 0;
    }
    const candidate = (stream[offset] << 8) | stream[offset + 1];
    offset += 2;
    if (candidate < 960) {
      return { startId: candidate, seedHash: bytesToHex(await sha256Bytes(base)) };
    }
  }
}

export async function deriveAndActivateAuthKey(ctx) {
  if (!isCommitRoundReady(ctx)) {
    throw new Error('commit round is not ready');
  }

  const noncePair = [ctx.commitRound.localNonceHex, ctx.commitRound.remoteNonceHex].sort();
  const nonceA = hexToBytes(noncePair[0]);
  const nonceB = hexToBytes(noncePair[1]);
  const ikm = concatBytes(nonceA, nonceB);
  const salt = new TextEncoder().encode(`meshtastic-chess|pv2.1|${ctx.sid}|${ctx.commitRound.cid}`);
  const info = new TextEncoder().encode('auth');
  const keyBytes = await hkdfSha256(ikm, salt, info, 32);

  ctx.auth.enabled = true;
  ctx.auth.keyBytes = keyBytes;
  return keyBytes;
}

export function shouldInitiateStartProposal(ctx) {
  if (!ctx.commitRound?.localCommit || !ctx.commitRound?.remoteCommit) return false;
  return ctx.commitRound.localCommit >= ctx.commitRound.remoteCommit;
}

export function buildStartProposalMessage(ctx, payload) {
  ctx.startProposal = { ...payload };
  ctx.state = 'start-sent';
  return buildPv2Envelope(ctx, 'START', payload);
}

export function validateStartProposal(ctx, msg) {
  if (!msg || msg.t !== 'START') return { ok: false, reason: 'not-start' };
  if (!Number.isInteger(msg.startId) || msg.startId < 0 || msg.startId > 959) {
    return { ok: false, reason: 'bad-start-id' };
  }
  if (typeof msg.startFen !== 'string' || !msg.startFen.includes('/')) {
    return { ok: false, reason: 'bad-start-fen' };
  }
  let expectedFen = '';
  try {
    expectedFen = buildChess960StartFen(msg.startId);
  } catch (_) {
    return { ok: false, reason: 'bad-start-id-fen' };
  }
  if (msg.startFen !== expectedFen) {
    return { ok: false, reason: 'start-fen-mismatch' };
  }
  if (typeof msg.variant !== 'string') {
    return { ok: false, reason: 'bad-variant' };
  }
  ctx.startProposal = {
    startId: msg.startId,
    startFen: msg.startFen,
    variant: msg.variant,
    seedHash: msg.seedHash || ''
  };
  ctx.state = 'start-received';
  return { ok: true };
}

export function buildAckMessage(ctx, ackT, ok = true, err = '') {
  return buildPv2Envelope(ctx, 'ACK', {
    ackT,
    ok: !!ok,
    err: ok ? '' : String(err || 'unknown')
  });
}

export function validateAckMessage(msg) {
  if (!msg || msg.t !== 'ACK') return { ok: false, reason: 'not-ack' };
  if (typeof msg.ackT !== 'string' || msg.ackT.length === 0) {
    return { ok: false, reason: 'bad-ack-target' };
  }
  if (typeof msg.ok !== 'boolean') {
    return { ok: false, reason: 'bad-ack-ok' };
  }
  if (!msg.ok && typeof msg.err !== 'string') {
    return { ok: false, reason: 'bad-ack-err' };
  }
  return { ok: true };
}

export function buildMoveMessage(ctx, payload) {
  return buildPv2Envelope(ctx, 'MOVE', {
    gameId: payload.gameId,
    uci: payload.uci,
    ply: payload.ply
  });
}

export function buildSyncMessage(ctx, payload) {
  return buildPv2Envelope(ctx, 'SYNC', {
    gameId: payload.gameId,
    moveCount: payload.moveCount,
    reply: !!payload.reply
  });
}
