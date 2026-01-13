# Meshtastic Web Chess

Play a chess game over Meshtastic using Web Serial. The UI runs in the browser
and exchanges moves directly between radios.

This project is mostly vibe coded.

[Play now](https://kb1jdx.com/chess-meshtastic/)

[![Meshtastic](https://img.shields.io/badge/mesh-meshtastic-0b8a5a?style=flat)](https://meshtastic.org)
[![Web Serial](https://img.shields.io/badge/web-serial-3367d6?style=flat)](https://developer.mozilla.org/en-US/docs/Web/API/Serial)
[![Status](https://img.shields.io/badge/status-experimental-f39c12?style=flat)](#)

## Why it is fun
- Zero server. Pure radio-to-radio chess.
- Random handshake picks colors and a shared game ID.
- Move-count sync to detect stalls and recover missing moves.

## Features
- Web Serial connection to a Meshtastic device
- Random handshake to pick colors and a shared game ID
- Move-count sync and reconnect checks
- Simple, single-page UI

## Requirements
- A browser with Web Serial support (Chromium-based)
- Two Meshtastic radios on the same mesh
- Recommended: add the `GameLobby` channel before playing

## Quick start
1. Serve the folder with any static file server.
2. Open `index.html` in your browser, or play it at https://kb1jdx.com/chess-meshtastic/.
3. Click **Connect**, select your serial device, and enter the opponent node ID.
4. Wait for the handshake to assign colors, then play.

## Usage
- After connecting, the app performs a handshake to pick colors and start a game.
- Moves are transmitted over the mesh.
- If a move is missing, the app uses move counts to retry and resync.

## Files
- `index.html`: UI and game logic
- `meshtastic-chess.js`: Serial framing + Meshtastic protobuf handling
- `meshtastic_bundle.json`: Protobuf schema bundle
- `vendor/protobuf.min.js`: Protobuf runtime

## Notes
- The opponent node ID can be entered as `0x...`, `!...`, or decimal.
- If you need to reset a game, use **Reset Game**.
- This is a lightweight experimental project, not a full client.
- Lobby channel details:
  - Name: `GameLobby`
  - PSK: `OpLah30Ci9oMvUDbXRGVcw3C55TOgUpQ23fxnYPpq2I=`
  - Recommended to add it before playing for smooth matchmaking.
- Licensing: the app uses the original third-party sources via their official URLs.
  If you want offline copies, download these into `lib/`:
  - https://code.jquery.com/jquery-1.12.4.min.js
  - https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js
  - https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js
  - https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css

## Troubleshooting
- If the handshake never completes, confirm both radios are on the same channel
  and the opponent node ID is correct.
- If moves do not transmit, reconnect and try again to re-run the handshake.
- If you see "Connection lost. Retrying...", the app is re-syncing move counts.

## Acknowledgements
- Meshtastic team and community
- Chessboard.js and Chess.js

[![CodeFactor](https://www.codefactor.io/repository/github/compuvin/chess-meshtastic/badge?s=86272db5d82ae02637bf412de630592c0d49cdbb)](https://www.codefactor.io/repository/github/compuvin/chess-meshtastic)
