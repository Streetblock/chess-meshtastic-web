import Chess960 from "./chess960.js";

function normalizeFenInput(startFen) {
  return (typeof startFen === "string" && startFen.includes("/")) ? startFen : null;
}

function parseUci(uci) {
  if (typeof uci !== "string" || uci.length < 4) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci[4] ? uci[4].toUpperCase() : "Q";
  return { from, to, promotion };
}

export function createGameEngine({ mode = "classic", startFen = null } = {}) {
  if (mode === "chess960") {
    return createChess960Engine(startFen);
  }
  return createClassicEngine(startFen);
}

function createClassicEngine(startFen) {
  const fen = normalizeFenInput(startFen);
  let game = fen ? new Chess(fen) : new Chess();

  return {
    mode: "classic",
    fen: () => game.fen(),
    turn: () => game.turn(),
    in_check: () => game.in_check(),
    in_checkmate: () => game.in_checkmate(),
    game_over: () => game.game_over(),
    move: (input) => game.move(input, { sloppy: true }),
    setStartFen: (nextFen) => {
      const normalized = normalizeFenInput(nextFen);
      game = normalized ? new Chess(normalized) : new Chess();
    }
  };
}

function createChess960Engine(startFen) {
  const engine = new Chess960();
  const fen = normalizeFenInput(startFen);
  let state = fen ? engine.importFEN(fen) : engine.createGame(engine.classicPositionId);

  return {
    mode: "chess960",
    fen: () => engine.exportFEN(state),
    turn: () => (state.activeColor === "white" ? "w" : "b"),
    in_check: () => state.status === "check",
    in_checkmate: () => state.status === "checkmate",
    game_over: () => ["checkmate", "stalemate", "draw"].includes(state.status),
    move: (input) => {
      try {
        let from;
        let to;
        let promotion = "Q";
        if (typeof input === "string") {
          const parsed = parseUci(input);
          if (!parsed) return null;
          from = parsed.from;
          to = parsed.to;
          promotion = parsed.promotion;
        } else {
          from = input?.from;
          to = input?.to;
          promotion = (input?.promotion || "q").toUpperCase();
        }
        if (!from || !to) return null;
        const next = engine.movePiece(state, from, to, promotion);
        const record = next.moveHistory[next.moveHistory.length - 1] || null;
        state = next;
        return record ? { from: record.from, to: record.to, promotion: record.promotion ? record.promotion.toLowerCase() : undefined } : { from, to };
      } catch (_) {
        return null;
      }
    },
    setStartFen: (nextFen) => {
      const normalized = normalizeFenInput(nextFen);
      state = normalized ? engine.importFEN(normalized) : engine.createGame(engine.classicPositionId);
    }
  };
}
