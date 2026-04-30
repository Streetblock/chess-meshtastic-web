import { createGameEngine } from "./engine/chess-engine.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const PIECES = {
  wK: "\u2654", wQ: "\u2655", wR: "\u2656", wB: "\u2657", wN: "\u2658", wP: "\u2659",
  bK: "\u265A", bQ: "\u265B", bR: "\u265C", bB: "\u265D", bN: "\u265E", bP: "\u265F"
};

function fenToBoardMap(fen) {
  const board = new Map();
  const placement = String(fen || "").split(/\s+/)[0];
  const ranks = placement.split("/");
  for (let row = 0; row < 8; row += 1) {
    let col = 0;
    for (const ch of ranks[row] || "") {
      if (/\d/.test(ch)) {
        col += Number(ch);
        continue;
      }
      const square = `${FILES[col]}${8 - row}`;
      board.set(square, ch);
      col += 1;
    }
  }
  return board;
}

function toPieceKey(fenChar) {
  const color = fenChar === fenChar.toUpperCase() ? "w" : "b";
  return `${color}${fenChar.toUpperCase()}`;
}

export function createChessUI(options) {
  const {
    onLocalMove,
    getGameStarted,
    setGameStarted,
    getLocalPlayerColor,
    getStartAcked,
    isConnected,
    getGameId,
    onResetGame,
    onReturnLobby
  } = options;

  let game = null;
  let boardRoot = null;
  let gameView = null;
  let gameStatus = null;
  let playerColorStatus = null;
  let connectionAlert = null;
  let selectedSquare = null;
  let startFen = null;
  let boardHandlers = [];

  function canInteractWith(square) {
    if (game.game_over() || (!getGameStarted() && getGameId() == null) || !isConnected()) return false;
    const localColor = getLocalPlayerColor();
    if (!localColor) return false;
    if (localColor === "w" && !getStartAcked()) return false;
    if (game.turn() !== localColor) return false;
    const pieceChar = fenToBoardMap(game.fen()).get(square);
    if (!pieceChar) return false;
    const pieceColor = pieceChar === pieceChar.toUpperCase() ? "w" : "b";
    return pieceColor === localColor;
  }

  function tryMove(from, to) {
    const move = game.move({ from, to, promotion: "q" });
    if (!move) return false;
    const moveUci = move.from + move.to + (move.promotion ? move.promotion : "");
    onLocalMove(moveUci);
    selectedSquare = null;
    renderBoard();
    updateStatus();
    return true;
  }

  function handleSquareClick(square) {
    if (selectedSquare) {
      if (!tryMove(selectedSquare, square)) {
        selectedSquare = canInteractWith(square) ? square : null;
      }
      renderBoard();
      return;
    }
    if (canInteractWith(square)) {
      selectedSquare = square;
      renderBoard();
    }
  }

  function bindBoardHandlers() {
    boardHandlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
    boardHandlers = [];
    boardRoot.querySelectorAll("[data-square]").forEach((sqEl) => {
      const square = sqEl.getAttribute("data-square");
      const fn = () => handleSquareClick(square);
      sqEl.addEventListener("click", fn);
      boardHandlers.push({ el: sqEl, fn });
    });
  }

  function renderBoard() {
    if (!boardRoot) return;
    const pieces = fenToBoardMap(game.fen());
    const rows = [];
    for (let row = 8; row >= 1; row -= 1) {
      for (let col = 0; col < 8; col += 1) {
        const square = `${FILES[col]}${row}`;
        const dark = (row + col) % 2 === 0;
        const fenChar = pieces.get(square);
        const pieceGlyph = fenChar ? PIECES[toPieceKey(fenChar)] || "" : "";
        const selected = selectedSquare === square ? " selected" : "";
        rows.push(
          `<button type="button" class="cm-square ${dark ? "dark" : "light"}${selected}" data-square="${square}" aria-label="${square}">${pieceGlyph}</button>`
        );
      }
    }
    boardRoot.innerHTML = rows.join("");
    bindBoardHandlers();
  }

  function mount() {
    gameView = document.getElementById("gameView");
    boardRoot = document.getElementById("board");
    gameStatus = document.getElementById("gameStatus");
    playerColorStatus = document.getElementById("playerColorStatus");
    connectionAlert = document.getElementById("connectionAlert");
    document.getElementById("resetBtn")?.addEventListener("click", resetGame);
    document.getElementById("returnLobbyBtn")?.addEventListener("click", onReturnLobby);
    game = createGameEngine({ startFen });
    renderBoard();
    updateStatus();
  }

  function unmount() {
    document.getElementById("resetBtn")?.removeEventListener("click", resetGame);
    document.getElementById("returnLobbyBtn")?.removeEventListener("click", onReturnLobby);
    boardHandlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
    boardHandlers = [];
    boardRoot = null;
    game = null;
    gameView = null;
    gameStatus = null;
    playerColorStatus = null;
    connectionAlert = null;
    selectedSquare = null;
  }

  function applyRemoteMove(uci) {
    const move = game.move(uci);
    if (move) {
      selectedSquare = null;
      renderBoard();
      updateStatus();
      return true;
    }
    updateStatus();
    return false;
  }

  function updateStatus() {
    if (!gameStatus) return;
    let status = "";
    const moveColor = (game.turn() === "b") ? "Black" : "White";
    if (game.game_over()) {
      setGameStarted(false);
      status = game.in_checkmate() ? `Game over, ${moveColor} is in checkmate.` : "Game over, drawn position.";
    } else if (!getGameStarted()) {
      status = "Waiting for handshake...";
    } else {
      status = `${moveColor} to move.`;
      if (game.in_check()) status += " (Check!)";
    }
    gameStatus.textContent = status;
  }

  function resetGame() {
    game = createGameEngine({ startFen });
    selectedSquare = null;
    renderBoard();
    if (getGameId() != null) setGameStarted(true);
    if (typeof onResetGame === "function") onResetGame();
    updateStatus();
  }

  function setStartFen(fen) {
    startFen = (typeof fen === "string" && fen.includes("/")) ? fen : null;
    game.setStartFen(startFen);
    selectedSquare = null;
    renderBoard();
    updateStatus();
  }

  function setPlayerColorStatus(text) {
    if (playerColorStatus) playerColorStatus.textContent = text || "";
  }

  function showConnectionAlert(text) {
    if (connectionAlert) connectionAlert.textContent = text || "";
  }

  function clearConnectionAlert() {
    if (connectionAlert) connectionAlert.textContent = "";
  }

  function showGameView() {
    if (gameView) gameView.style.display = "";
  }

  function hideGameView() {
    if (gameView) gameView.style.display = "none";
  }

  return {
    mount,
    unmount,
    applyRemoteMove,
    updateStatus,
    resetGame,
    setStartFen,
    setPlayerColorStatus,
    showConnectionAlert,
    clearConnectionAlert,
    showGameView,
    hideGameView
  };
}
