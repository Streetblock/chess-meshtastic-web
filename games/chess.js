import { createGameEngine } from "./engine/chess-engine.js";

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
    getGameMode
  } = options;

  let board = null;
  let game = null;
  let $gameView = null;
  let $gameStatus = null;
  let $playerColorStatus = null;
  let $connectionAlert = null;
  let startFen = null;
  const inlinePieceCache = new Map();

  function getInlinePieceSvg(piece) {
    const pieceGlyphs = {
      wK: '\u2654',
      wQ: '\u2655',
      wR: '\u2656',
      wB: '\u2657',
      wN: '\u2658',
      wP: '\u2659',
      bK: '\u265A',
      bQ: '\u265B',
      bR: '\u265C',
      bB: '\u265D',
      bN: '\u265E',
      bP: '\u265F'
    };

    if (inlinePieceCache.has(piece)) {
      return inlinePieceCache.get(piece);
    }

    const glyph = pieceGlyphs[piece];
    if (!glyph) return '';

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
      '<rect width="100" height="100" fill="transparent"/>',
      '<text',
      ' x="50"',
      ' y="54"',
      ' text-anchor="middle"',
      ' dominant-baseline="middle"',
      ' font-size="78"',
      ' font-family="Segoe UI Symbol, Noto Sans Symbols 2, Noto Sans Symbols, DejaVu Sans, Symbola, serif">',
      glyph,
      '</text>',
      '</svg>'
    ].join('');

    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    inlinePieceCache.set(piece, url);
    return url;
  }

  function onDragStart(source, piece) {
    if (game.game_over() || (!getGameStarted() && getGameId() == null) || !isConnected()) return false;
    if (getLocalPlayerColor() == null) return false;
    if (getLocalPlayerColor() === 'w' && !getStartAcked()) return false;
    if (game.turn() !== getLocalPlayerColor()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
      return false;
    }
  }

  function onDrop(source, target) {
    const temp = { from: source, to: target, promotion: 'q' };
    const move = game.move(temp);
    if (!move) return 'snapback';

    const moveUCI = move.from + move.to + (move.promotion ? move.promotion : '');
    onLocalMove(moveUCI);
    updateStatus();
  }

  function onSnapEnd() {
    board.position(game.fen());
  }

  const cbConfig = {
    draggable: true,
    position: 'start',
    onDragStart,
    onDrop,
    onSnapEnd,
    pieceTheme: getInlinePieceSvg
  };

  function mount() {
    $gameView = $('#gameView');
    $gameStatus = $('#gameStatus');
    $playerColorStatus = $('#playerColorStatus');
    $connectionAlert = $('#connectionAlert');
    $('#resetBtn').on('click', resetGame);
    $('#returnLobbyBtn').on('click', options.onReturnLobby);
    game = createGameEngine({
      mode: typeof getGameMode === 'function' ? getGameMode() : 'classic',
      startFen
    });
    board = ChessBoard('board', cbConfig);
    if (startFen) {
      board.position(startFen);
    }
    updateStatus();
  }

  function unmount() {
    $('#resetBtn').off('click', resetGame);
    $('#returnLobbyBtn').off('click', options.onReturnLobby);
    if (board && typeof board.destroy === 'function') {
      board.destroy();
    }
    board = null;
    game = null;
    $gameView = null;
    $gameStatus = null;
    $playerColorStatus = null;
    $connectionAlert = null;
  }

  function applyRemoteMove(uci) {
    const move = game.move(uci, { sloppy: true });
    if (move) {
      board.position(game.fen());
      updateStatus();
      return true;
    }
    updateStatus();
    return false;
  }

  function updateStatus() {
    if (!$gameStatus) return;
    let status = '';
    const moveColor = (game.turn() === 'b') ? 'Black' : 'White';
    if (game.game_over()) {
      setGameStarted(false);
      status = game.in_checkmate() ? `Game over, ${moveColor} is in checkmate.` : 'Game over, drawn position.';
    } else if (!getGameStarted()) {
      status = 'Waiting for handshake...';
    } else {
      status = moveColor + ' to move.';
      if (game.in_check()) status += ' (Check!)';
    }
    $gameStatus.text(status);
  }

  function resetGame() {
    game = createGameEngine({
      mode: typeof getGameMode === 'function' ? getGameMode() : 'classic',
      startFen
    });
    board.position(startFen || 'start');
    if (getGameId() != null) {
      setGameStarted(true);
    }
    if (typeof onResetGame === 'function') {
      onResetGame();
    }
    updateStatus();
  }

  function setPlayerColorStatus(text) {
    if ($playerColorStatus) $playerColorStatus.text(text || '');
  }

  function showConnectionAlert(text) {
    if ($connectionAlert) $connectionAlert.text(text || '');
  }

  function clearConnectionAlert() {
    if ($connectionAlert) $connectionAlert.text('');
  }

  function showGameView() {
    if ($gameView) $gameView.show();
  }

  function hideGameView() {
    if ($gameView) $gameView.hide();
  }

  function setStartFen(fen) {
    startFen = (typeof fen === 'string' && fen.includes('/')) ? fen : null;
    try {
      game = createGameEngine({
        mode: typeof getGameMode === 'function' ? getGameMode() : 'classic',
        startFen
      });
      if (board) {
        board.position(startFen || 'start');
      }
      updateStatus();
      return true;
    } catch (err) {
      console.warn("[GAME] Invalid start FEN, falling back to classic start.", err);
      startFen = null;
      game = createGameEngine({
        mode: typeof getGameMode === 'function' ? getGameMode() : 'classic',
        startFen: null
      });
      if (board) {
        board.position('start');
      }
      updateStatus();
      return false;
    }
  }

  return {
    mount,
    unmount,
    applyRemoteMove,
    updateStatus,
    resetGame,
    setPlayerColorStatus,
    showConnectionAlert,
    clearConnectionAlert,
    showGameView,
    hideGameView,
    setStartFen
  };
}
