export function createChessUI(options) {
  const {
    onLocalMove,
    getGameStarted,
    setGameStarted,
    getLocalPlayerColor,
    getStartAcked,
    isConnected,
    getGameId,
    onResetGame
  } = options;

  let board = null;
  let game = null;
  let $gameView = null;
  let $gameStatus = null;
  let $playerColorStatus = null;
  let $connectionAlert = null;

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
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
  };

  function mount() {
    $gameView = $('#gameView');
    $gameStatus = $('#gameStatus');
    $playerColorStatus = $('#playerColorStatus');
    $connectionAlert = $('#connectionAlert');
    $('#resetBtn').on('click', resetGame);
    $('#returnLobbyBtn').on('click', options.onReturnLobby);
    game = new Chess();
    board = ChessBoard('board', cbConfig);
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
    game = new Chess();
    board.position('start');
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
    hideGameView
  };
}
