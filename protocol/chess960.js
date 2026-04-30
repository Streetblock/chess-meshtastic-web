function placeAtEmptySlot(row, n, piece) {
  let emptySeen = 0;
  for (let i = 0; i < row.length; i += 1) {
    if (row[i] === null) {
      if (emptySeen === n) {
        row[i] = piece;
        return;
      }
      emptySeen += 1;
    }
  }
}

const KNIGHT_MAPPING = [
  [0, 1], [0, 2], [0, 3], [0, 4], [1, 2],
  [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]
];

export function generateChess960BackRank(id) {
  if (!Number.isInteger(id) || id < 0 || id > 959) {
    throw new Error('Chess960 id must be an integer in [0, 959]');
  }

  const row = new Array(8).fill(null);
  let n = id;

  const lightBishopPos = (n % 4) * 2 + 1;
  row[lightBishopPos] = 'B';
  n = Math.floor(n / 4);

  const darkBishopPos = (n % 4) * 2;
  row[darkBishopPos] = 'B';
  n = Math.floor(n / 4);

  const queenPosIndex = n % 6;
  placeAtEmptySlot(row, queenPosIndex, 'Q');
  n = Math.floor(n / 6);

  const knightCombo = KNIGHT_MAPPING[n];
  placeAtEmptySlot(row, knightCombo[0], 'N');
  placeAtEmptySlot(row, knightCombo[1] - 1, 'N');

  placeAtEmptySlot(row, 0, 'R');
  placeAtEmptySlot(row, 0, 'K');
  placeAtEmptySlot(row, 0, 'R');

  return row;
}

export function buildChess960StartFen(id) {
  const whiteBackRank = generateChess960BackRank(id);
  const blackBackRank = whiteBackRank.join('').toLowerCase();
  const whiteBackRankFen = whiteBackRank.join('');
  return `${blackBackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteBackRankFen} w KQkq - 0 1`;
}
