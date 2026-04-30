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

export function createPv2Context() {
  return {
    enabled: false,
    protocolVersion: PV2,
    sid: randomHex(16),
    seq: 1,
    localCaps: ['c960', 'commit-reveal', 'hmac', 'fen-hash'],
    remoteCaps: [],
    peerSeqByNode: new Map(),
    state: 'idle'
  };
}

export function resetPv2Context(ctx) {
  ctx.enabled = false;
  ctx.sid = randomHex(16);
  ctx.seq = 1;
  ctx.remoteCaps = [];
  ctx.peerSeqByNode.clear();
  ctx.state = 'idle';
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
