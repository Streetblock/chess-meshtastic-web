import Chess960 from "./chess960.js";

function normalizeFenInput(startFen) {
  return (typeof startFen === "string" && startFen.includes("/")) ? startFen : null;
}

function parseUci(uci) {
  if (typeof uci !== "string" || uci.length < 4) return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] ? uci[4].toUpperCase() : "Q"
  };
}

export function createGameEngine({ startFen = null } = {}) {
  const engine = new Chess960();
  const fen = normalizeFenInput(startFen);
  let state = fen ? engine.importFEN(fen) : engine.createGame(engine.classicPositionId);

  return {
    fen: () => engine.exportFEN(state),
    turn: () => (state.activeColor === "white" ? "w" : "b"),
    in_check: () => state.status === "check",
    in_checkmate: () => state.status === "checkmate",
    game_over: () => ["checkmate", "stalemate", "draw"].includes(state.status),
    move: (input) => {
      try {
        const parsed = typeof input === "string"
          ? parseUci(input)
          : { from: input?.from, to: input?.to, promotion: (input?.promotion || "q").toUpperCase() };
        if (!parsed?.from || !parsed?.to) return null;
        const next = engine.movePiece(state, parsed.from, parsed.to, parsed.promotion);
        const move = next.moveHistory?.[next.moveHistory.length - 1];
        state = next;
        if (!move) return { from: parsed.from, to: parsed.to };
        return {
          from: move.from,
          to: move.to,
          promotion: move.promotion ? move.promotion.toLowerCase() : undefined
        };
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
