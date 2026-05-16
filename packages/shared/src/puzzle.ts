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

export function getWorkspaceMargin(layout: PuzzleLayout): number {
  return Math.max(layout.pieceWidth * 3.1, layout.pieceHeight * 3.1, Math.min(layout.boardWidth, layout.boardHeight) * 0.3);
}

export function createInitialPieces(layout: PuzzleLayout): BoardPiece[] {
  const margin = getWorkspaceMargin(layout);
  const pieceMin = Math.min(layout.pieceWidth, layout.pieceHeight);
  const gap = Math.max(8, pieceMin * 0.12);
  const seed = layout.difficulty * 1_000_003 + Math.round(layout.boardWidth * 17 + layout.boardHeight * 31);
  const slots = createScatterSlots(layout, margin, gap, seed);
  const shuffledPieces = [...layout.pieces].sort((a, b) => hashNoise(a.id, seed + 19) - hashNoise(b.id, seed + 19));
  const shuffledSlots = [...slots].sort((a, b) => a.sort - b.sort);
  const fallbackRadiusX = layout.boardWidth / 2 + margin * 0.55;
  const fallbackRadiusY = layout.boardHeight / 2 + margin * 0.55;

  return shuffledPieces.map((piece, index) => {
    const slot = shuffledSlots[index] ?? createFallbackScatterSlot(index, layout, fallbackRadiusX, fallbackRadiusY, seed);
    return {
      id: piece.id,
      targetX: piece.targetX,
      targetY: piece.targetY,
      x: slot.x,
      y: slot.y,
      z: index + 1,
      locked: false,
    };
  }).sort((a, b) => a.id - b.id);
}

function createScatterSlots(layout: PuzzleLayout, margin: number, gap: number, seed: number): Array<{ x: number; y: number; sort: number }> {
  const required = layout.pieces.length;
  const padding = Math.max(4, Math.min(layout.pieceWidth, layout.pieceHeight) * 0.06);
  const slotsTarget = Math.ceil(required * 1.35);
  const maxAttempts = required * 90;
  const spatialIndex = createSlotSpatialIndex(layout, padding);
  const slots: Array<{ x: number; y: number; sort: number }> = [];

  for (let attempt = 0; attempt < maxAttempts && slots.length < slotsTarget; attempt += 1) {
    const candidate = createBandCandidate(attempt, layout, margin, gap, seed);
    if (!isOutsideFrame(candidate, layout, gap * 0.7)) continue;
    if (spatialIndex.overlaps(candidate)) continue;
    slots.push(candidate);
    spatialIndex.add(candidate);
  }

  return slots;
}

function createSlotSpatialIndex(layout: PuzzleLayout, padding: number): {
  add: (slot: { x: number; y: number }) => void;
  overlaps: (slot: { x: number; y: number }) => boolean;
} {
  const cellSize = Math.max(layout.pieceWidth, layout.pieceHeight) + padding;
  const cells = new Map<string, Array<{ x: number; y: number }>>();

  function cellRange(slot: { x: number; y: number }): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
      minX: Math.floor((slot.x - padding) / cellSize),
      maxX: Math.floor((slot.x + layout.pieceWidth + padding) / cellSize),
      minY: Math.floor((slot.y - padding) / cellSize),
      maxY: Math.floor((slot.y + layout.pieceHeight + padding) / cellSize),
    };
  }

  function cellKey(x: number, y: number): string {
    return `${x}:${y}`;
  }

  return {
    add(slot) {
      const range = cellRange(slot);
      for (let y = range.minY; y <= range.maxY; y += 1) {
        for (let x = range.minX; x <= range.maxX; x += 1) {
          const key = cellKey(x, y);
          const bucket = cells.get(key);
          if (bucket) bucket.push(slot);
          else cells.set(key, [slot]);
        }
      }
    },
    overlaps(slot) {
      const range = cellRange(slot);
      const checked = new Set<{ x: number; y: number }>();
      for (let y = range.minY; y <= range.maxY; y += 1) {
        for (let x = range.minX; x <= range.maxX; x += 1) {
          for (const existing of cells.get(cellKey(x, y)) ?? []) {
            if (checked.has(existing)) continue;
            checked.add(existing);
            if (rectanglesOverlap(slot, existing, layout, padding)) return true;
          }
        }
      }
      return false;
    },
  };
}

function createBandCandidate(index: number, layout: PuzzleLayout, margin: number, gap: number, seed: number): { x: number; y: number; sort: number } {
  const sideNoise = layeredNoise(index * 0.41, seed + 7);
  const side = sideNoise < 0.27 ? "top" : sideNoise < 0.54 ? "bottom" : sideNoise < 0.77 ? "left" : "right";
  const primary = layeredNoise(index * 0.83 + 3.7, seed + 31);
  const secondary = layeredNoise(index * 1.17 + 9.1, seed + 67);
  const drift = layeredNoise(index * 0.29 + 15.3, seed + 113) - 0.5;
  const xMin = -margin;
  const xMax = layout.boardWidth + margin - layout.pieceWidth;
  const yMin = -margin;
  const yMax = layout.boardHeight + margin - layout.pieceHeight;

  if (side === "top") {
    return {
      x: lerp(xMin, xMax, primary) + drift * layout.pieceWidth * 0.35,
      y: lerp(yMin, -layout.pieceHeight - gap, secondary),
      sort: layeredNoise(index * 1.37 + 5.1, seed + 97),
    };
  }

  if (side === "bottom") {
    return {
      x: lerp(xMin, xMax, primary) + drift * layout.pieceWidth * 0.35,
      y: lerp(layout.boardHeight + gap, yMax, secondary),
      sort: layeredNoise(index * 1.37 + 5.1, seed + 97),
    };
  }

  if (side === "left") {
    return {
      x: lerp(xMin, -layout.pieceWidth - gap, secondary),
      y: lerp(-layout.pieceHeight * 0.25, layout.boardHeight - layout.pieceHeight * 0.75, primary) + drift * layout.pieceHeight * 0.35,
      sort: layeredNoise(index * 1.37 + 5.1, seed + 97),
    };
  }

  return {
    x: lerp(layout.boardWidth + gap, xMax, secondary),
    y: lerp(-layout.pieceHeight * 0.25, layout.boardHeight - layout.pieceHeight * 0.75, primary) + drift * layout.pieceHeight * 0.35,
    sort: layeredNoise(index * 1.37 + 5.1, seed + 97),
  };
}

function createFallbackScatterSlot(index: number, layout: PuzzleLayout, radiusX: number, radiusY: number, seed: number): { x: number; y: number } {
  const angle = index * 2.399963229728653 + hashNoise(index, seed) * 0.5;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const frameRadiusX = layout.boardWidth / 2 + layout.pieceWidth / 2;
  const frameRadiusY = layout.boardHeight / 2 + layout.pieceHeight / 2;
  const edgeDistance = Math.min(frameRadiusX / Math.max(0.001, Math.abs(directionX)), frameRadiusY / Math.max(0.001, Math.abs(directionY)));
  const scatterDistance = Math.max(edgeDistance + Math.min(layout.pieceWidth, layout.pieceHeight) * 0.2, Math.min(radiusX, radiusY) * (0.85 + hashNoise(index, seed + 37) * 0.3));

  return {
    x: layout.boardWidth / 2 - layout.pieceWidth / 2 + directionX * scatterDistance,
    y: layout.boardHeight / 2 - layout.pieceHeight / 2 + directionY * scatterDistance,
  };
}

function isOutsideFrame(slot: { x: number; y: number }, layout: PuzzleLayout, padding: number): boolean {
  return (
    slot.x + layout.pieceWidth <= -padding ||
    slot.x >= layout.boardWidth + padding ||
    slot.y + layout.pieceHeight <= -padding ||
    slot.y >= layout.boardHeight + padding
  );
}

function rectanglesOverlap(a: { x: number; y: number }, b: { x: number; y: number }, layout: PuzzleLayout, padding: number): boolean {
  return (
    a.x < b.x + layout.pieceWidth + padding &&
    a.x + layout.pieceWidth + padding > b.x &&
    a.y < b.y + layout.pieceHeight + padding &&
    a.y + layout.pieceHeight + padding > b.y
  );
}

function layeredNoise(value: number, seed: number): number {
  return valueNoise(value, seed) * 0.6 + valueNoise(value * 0.5 + 17.3, seed + 83) * 0.3 + valueNoise(value * 0.25 + 41.9, seed + 191) * 0.1;
}

function valueNoise(value: number, seed: number): number {
  const left = Math.floor(value);
  const t = value - left;
  const smooth = t * t * (3 - 2 * t);
  return lerp(hashNoise(left, seed), hashNoise(left + 1, seed), smooth);
}

function hashNoise(value: number, seed: number): number {
  const noise = Math.sin(value * 12.9898 + seed * 78.233) * 43_758.5453;
  return noise - Math.floor(noise);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
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
