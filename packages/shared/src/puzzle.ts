import type { Difficulty, SyncedPiece } from "./protocol";

export type PieceEdge = -1 | 0 | 1;

export type PieceGeometry = {
  id: number;
  row: number;
  col: number;
  edges: {
    top: PieceEdge;
    right: PieceEdge;
    bottom: PieceEdge;
    left: PieceEdge;
  };
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  targetX: number;
  targetY: number;
};

export type PuzzleLayout = {
  difficulty: Difficulty;
  rows: number;
  cols: number;
  boardWidth: number;
  boardHeight: number;
  pieceWidth: number;
  pieceHeight: number;
  pieces: PieceGeometry[];
};

export type BoardPiece = SyncedPiece & {
  targetX: number;
  targetY: number;
};

export function factorGrid(count: Difficulty, imageWidth: number, imageHeight: number): { rows: number; cols: number } {
  const ratio = imageWidth / imageHeight;
  let best: { rows: number; cols: number; score: number } = { rows: count, cols: 1, score: Number.POSITIVE_INFINITY };

  for (let rows = 1; rows <= count; rows += 1) {
    if (count % rows !== 0) continue;
    const cols = count / rows;
    const gridRatio = cols / rows;
    const score = Math.abs(Math.log(gridRatio / ratio));
    if (score < best.score) {
      best = { rows, cols, score };
    }
  }

  return { rows: best.rows, cols: best.cols };
}

export function createPuzzleLayout(difficulty: Difficulty, imageWidth: number, imageHeight: number): PuzzleLayout {
  const { rows, cols } = factorGrid(difficulty, imageWidth, imageHeight);
  const pieceWidth = imageWidth / cols;
  const pieceHeight = imageHeight / rows;
  const pieces: PieceGeometry[] = [];
  const horizontalEdges = Array.from({ length: Math.max(0, rows - 1) }, (_, row) =>
    Array.from({ length: cols }, (_, col) => edgeDirection(row, col, "horizontal")),
  );
  const verticalEdges = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: Math.max(0, cols - 1) }, (_, col) => edgeDirection(row, col, "vertical")),
  );

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const id = row * cols + col;
      pieces.push({
        id,
        row,
        col,
        edges: {
          top: row === 0 ? 0 : (-horizontalEdges[row - 1][col] as PieceEdge),
          right: col === cols - 1 ? 0 : verticalEdges[row][col],
          bottom: row === rows - 1 ? 0 : horizontalEdges[row][col],
          left: col === 0 ? 0 : (-verticalEdges[row][col - 1] as PieceEdge),
        },
        sourceX: col * pieceWidth,
        sourceY: row * pieceHeight,
        sourceWidth: pieceWidth,
        sourceHeight: pieceHeight,
        targetX: col * pieceWidth,
        targetY: row * pieceHeight,
      });
    }
  }

  return {
    difficulty,
    rows,
    cols,
    boardWidth: imageWidth,
    boardHeight: imageHeight,
    pieceWidth,
    pieceHeight,
    pieces,
  };
}

function edgeDirection(row: number, col: number, axis: "horizontal" | "vertical"): PieceEdge {
  return ((row * 31 + col * 17 + (axis === "horizontal" ? 7 : 13)) % 2 === 0 ? 1 : -1) as PieceEdge;
}

export function createInitialPieces(layout: PuzzleLayout): BoardPiece[] {
  const spreadX = layout.boardWidth * 0.12;
  const spreadY = layout.boardHeight * 0.12;

  return layout.pieces.map((piece, index) => {
    const lane = index % 4;
    const offset = Math.floor(index / 4) * 11;
    return {
      id: piece.id,
      targetX: piece.targetX,
      targetY: piece.targetY,
      x: Math.max(0, Math.min(layout.boardWidth - layout.pieceWidth, piece.targetX + (lane - 1.5) * spreadX + offset)),
      y: Math.max(0, Math.min(layout.boardHeight - layout.pieceHeight, piece.targetY + ((lane % 2) - 0.5) * spreadY + offset)),
      z: index + 1,
      locked: false,
    };
  });
}

export function shouldSnap(piece: Pick<BoardPiece, "x" | "y" | "targetX" | "targetY">, threshold: number): boolean {
  return Math.hypot(piece.x - piece.targetX, piece.y - piece.targetY) <= threshold;
}

export function snapPiece(piece: BoardPiece, threshold: number): BoardPiece {
  if (!shouldSnap(piece, threshold)) return piece;
  return { ...piece, x: piece.targetX, y: piece.targetY, locked: true };
}

export function isComplete(pieces: Pick<BoardPiece, "locked">[]): boolean {
  return pieces.length > 0 && pieces.every((piece) => piece.locked);
}
