# Protocol Test Matrix (`pv1` / `pv2.0` / `pv2.1`)

This matrix covers interoperability for:
- Legacy flow (`pv1`)
- Commit/Reveal + Chess960 flow (`pv2.0`)
- Authenticated flow (`pv2.1`)

## Preconditions
- Two test nodes (`A`, `B`) on the same mesh.
- Clean browser state (reload, reconnect between cases).
- Logging enabled in DevTools for both sides.
- For `pv2.1` tests, ensure both sides are on a branch with HMAC support.

## Legend
- `OK`: expected to succeed.
- `FALLBACK`: expected to use legacy compatibility path.
- `REJECT`: expected rejection (protocol/auth mismatch).

## Matrix

| A version | B version | Lobby/Match | Start handshake | Move exchange | Sync/Retry | Expected |
|---|---|---|---|---|---|---|
| `pv1` | `pv1` | legacy | legacy `H/S/K` | legacy `M` | legacy `C` | `OK` |
| `pv2.0` | `pv2.0` | `HELLO` + lobby | Commit/Reveal + `START/ACK` + classic bridge | `MOVE` | `SYNC` | `OK` |
| `pv2.1` | `pv2.1` | `HELLO` + caps | Commit/Reveal + `START/ACK` (MAC) | `MOVE` (MAC) | `SYNC` (MAC) | `OK` |
| `pv2.0` | `pv1` | lobby mixed | legacy bridge | legacy fallback | legacy fallback | `FALLBACK` |
| `pv2.1` | `pv1` | lobby mixed | legacy mirror path | legacy mirror (`M`) | legacy mirror (`C`) | `FALLBACK` |
| `pv2.1` | `pv2.0` (no `hmac` cap) | `HELLO` | Commit/Reveal + `START/ACK` | `MOVE` + legacy mirror | `SYNC` + legacy mirror | `FALLBACK` |
| `pv2.1` | `pv2.0` (claims `hmac`, no valid MAC) | `HELLO` | start may begin | `MOVE/SYNC` auth check | auth check | `REJECT` |

## Per-case checks

1. Connection and hello:
- Verify `HELLO` is sent/received on both sides (`[PV2 TX]`, `[PV2] HELLO accepted`).

2. Commit/Reveal:
- Verify both `COMMIT` and `REVEAL` messages are accepted.
- Verify both sides reach commit-ready and derive same `startId`/`startFen`.

3. Start proposal and ACK:
- Verify `START` accepted on peer.
- Verify `ACK` returned and logged (`START ACK accepted`).

4. Move path:
- In `pv2.1 <-> pv2.1`, verify `MOVE` and MAC checks pass.
- In mixed (`no hmac` peer), verify mirrored legacy move is sent when required.

5. Sync path:
- Trigger timeout or manual retry and verify `SYNC` path.
- In mixed mode, verify legacy mirror for sync (`C`) is emitted.

6. Negative/auth tests:
- Tamper with `mac` (or remove it) on critical message (`START`/`MOVE`/`SYNC`) and verify rejection.

## Quick manual scenarios

1. `pv2.1` vs `pv1`:
- Start game from `pv2.1`.
- Confirm moves still arrive on `pv1` side via mirror path.

2. `pv2.1` vs `pv2.0`:
- Confirm both can start and play.
- Confirm `pv2.1` logs mirror mode for peers without `hmac` cap.

3. `pv2.1` vs `pv2.1`:
- Confirm no legacy mirror needed.
- Confirm critical message auth enforcement works.
