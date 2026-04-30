import Chess960 from "../games/engine/chess960.js";

const chess960 = new Chess960();

export function generateChess960BackRank(id) {
  return chess960.generate(id);
}

export function buildChess960StartFen(id) {
  const game = chess960.createGame(id);
  return chess960.exportFEN(game);
}
