import type { BoardPiece, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { SyncedPiece } from "@open-puzzle/shared/protocol";

export const MAX_CANVAS_COORDINATE = 1_000_000_000;

export type SelectionState = {
  pieceIds: Set<number>;
  imageOverlaySelected: boolean;
  lastSelectedPieceId: number | null;
};

export type Rect = { x: number; y: number; width: number; height: number };

export function countLockedPieces(pieces: Pick<BoardPiece, "locked">[]): number {
  let count = 0;
  for (const piece of pieces) {
    if (piece.locked) count++;
  }
  return count;
}

export function updatePieceById(
  pieces: BoardPiece[],
  pieceId: number,
  update: (piece: BoardPiece) => BoardPiece,
): BoardPiece[] {
  const piece = pieces[pieceId];
  if (!piece || piece.id !== pieceId) {
    return pieces.map((c) => (c.id === pieceId ? update(c) : c));
  }
  const next = update(piece);
  if (next === piece) return pieces;
  const arr = pieces.slice();
  arr[pieceId] = next;
  return arr;
}

export function mergeSyncedPieces(current: BoardPiece[], synced: SyncedPiece[]): BoardPiece[] {
  const byId = new Map(synced.map((p) => [p.id, p]));
  return current.map((piece) => {
    const next = byId.get(piece.id);
    return next ? { ...piece, x: next.x, y: next.y, z: next.z, locked: next.locked } : piece;
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundZoom(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isLoosePieceEventTarget(target: EventTarget): boolean {
  return target instanceof Element && Boolean(target.closest(".piece:not(.locked)"));
}

export function isViewportPanButton(button: number): boolean {
  return button === 0 || button === 1;
}

export function shouldStartViewportPan(button: number, target: EventTarget): boolean {
  if (!isViewportPanButton(button)) return false;
  return button === 1 || !isLoosePieceEventTarget(target);
}

export function createEmptySelection(): SelectionState {
  return { pieceIds: new Set(), imageOverlaySelected: false, lastSelectedPieceId: null };
}

export function selectOnlyPiece(pieceId: number): SelectionState {
  return { pieceIds: new Set([pieceId]), imageOverlaySelected: false, lastSelectedPieceId: pieceId };
}

export function togglePieceSelection(selection: SelectionState, pieceId: number): SelectionState {
  const pieceIds = new Set(selection.pieceIds);
  if (pieceIds.has(pieceId)) pieceIds.delete(pieceId);
  else pieceIds.add(pieceId);
  return { pieceIds, imageOverlaySelected: selection.imageOverlaySelected, lastSelectedPieceId: pieceId };
}

export function addPieceRangeSelection(selection: SelectionState, toPieceId: number): SelectionState {
  if (selection.lastSelectedPieceId === null) return selectOnlyPiece(toPieceId);
  const pieceIds = new Set(selection.pieceIds);
  const start = Math.min(selection.lastSelectedPieceId, toPieceId);
  const end = Math.max(selection.lastSelectedPieceId, toPieceId);
  for (let id = start; id <= end; id += 1) pieceIds.add(id);
  return { pieceIds, imageOverlaySelected: selection.imageOverlaySelected, lastSelectedPieceId: toPieceId };
}

export function selectOnlyImageOverlay(): SelectionState {
  return { pieceIds: new Set(), imageOverlaySelected: true, lastSelectedPieceId: null };
}

export function toggleImageOverlaySelection(selection: SelectionState): SelectionState {
  return {
    pieceIds: new Set(selection.pieceIds),
    imageOverlaySelected: !selection.imageOverlaySelected,
    lastSelectedPieceId: selection.lastSelectedPieceId,
  };
}

export function normalizeRect(start: { x: number; y: number }, end: { x: number; y: number }): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function selectByRect(
  pieces: BoardPiece[],
  layout: PuzzleLayout,
  rect: Rect,
  imageOverlayRect: Rect | null,
): SelectionState {
  const pieceIds = new Set<number>();
  for (const piece of pieces) {
    if (rectsIntersect(rect, { x: piece.x, y: piece.y, width: layout.pieceWidth, height: layout.pieceHeight })) {
      pieceIds.add(piece.id);
    }
  }
  const imageOverlaySelected = Boolean(imageOverlayRect && rectsIntersect(rect, imageOverlayRect));
  return { pieceIds, imageOverlaySelected, lastSelectedPieceId: pieceIds.size ? [...pieceIds].at(-1)! : null };
}

export function bringSelectedPiecesToFront(pieces: BoardPiece[], selectedPieceIds: Set<number>): BoardPiece[] {
  const selected = pieces.filter((piece) => selectedPieceIds.has(piece.id));
  if (!selected.length) return pieces;
  const nextTopZ = Math.max(0, ...pieces.map((piece) => piece.z)) + 1;
  const zById = new Map(
    selected
      .slice()
      .sort((a, b) => a.z - b.z || a.id - b.id)
      .map((piece, index) => [piece.id, nextTopZ + index]),
  );
  return pieces.map((piece) => {
    const z = zById.get(piece.id);
    return z === undefined ? piece : { ...piece, z };
  });
}

export function getConnectedLoosePieceIds(
  pieces: BoardPiece[],
  seedPieceIds: Set<number>,
  layout: PuzzleLayout,
  tolerance = 0.5,
): Set<number> {
  const connected = new Set<number>();
  const queue: number[] = [];

  for (const pieceId of seedPieceIds) {
    const piece = pieces.find((candidate) => candidate.id === pieceId);
    if (!piece || piece.locked) continue;
    connected.add(piece.id);
    queue.push(piece.id);
  }

  while (queue.length) {
    const pieceId = queue.shift()!;
    const piece = pieces.find((candidate) => candidate.id === pieceId);
    if (!piece) continue;

    for (const candidate of pieces) {
      if (candidate.locked || connected.has(candidate.id)) continue;
      if (!areSnappedNeighbors(piece, candidate, layout, tolerance)) continue;
      connected.add(candidate.id);
      queue.push(candidate.id);
    }
  }

  return connected;
}

export function snapLoosePiecesToNeighbors(
  pieces: BoardPiece[],
  movedPieceIds: Set<number>,
  layout: PuzzleLayout,
  threshold: number,
): BoardPiece[] {
  const movableIds = new Set([...movedPieceIds].filter((pieceId) => {
    const piece = pieces.find((candidate) => candidate.id === pieceId);
    return piece && !piece.locked;
  }));
  if (!movableIds.size) return pieces;

  let best: { distance: number; deltaX: number; deltaY: number } | null = null;

  for (const moved of pieces) {
    if (!movableIds.has(moved.id)) continue;

    for (const anchor of pieces) {
      if (movableIds.has(anchor.id) || !areLayoutNeighbors(moved.id, anchor.id, layout)) continue;
      const expectedX = anchor.x + moved.targetX - anchor.targetX;
      const expectedY = anchor.y + moved.targetY - anchor.targetY;
      const deltaX = expectedX - moved.x;
      const deltaY = expectedY - moved.y;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > threshold || (best && distance >= best.distance)) continue;
      best = { distance, deltaX, deltaY };
    }
  }

  if (!best) return pieces;

  return pieces.map((piece) => {
    if (!movableIds.has(piece.id) || piece.locked) return piece;
    return { ...piece, x: piece.x + best.deltaX, y: piece.y + best.deltaY };
  });
}

export function moveSelectedLoosePiecesBy(
  pieces: BoardPiece[],
  selectedPieceIds: Set<number>,
  delta: { x: number; y: number },
): BoardPiece[] {
  return pieces.map((piece) => {
    if (piece.locked || !selectedPieceIds.has(piece.id)) return piece;
    return { ...piece, x: piece.x + delta.x, y: piece.y + delta.y };
  });
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function arrangeLoosePieces(
  pieces: BoardPiece[],
  layout: PuzzleLayout,
  rng: () => number = Math.random,
): BoardPiece[] {
  const gap = Math.max(8, Math.min(layout.pieceWidth, layout.pieceHeight) * 0.12);
  const loosePieces = pieces.filter((piece) => !piece.locked);
  const columns = Math.max(1, Math.ceil(Math.sqrt(loosePieces.length)));
  const nextTopZ = Math.max(0, ...pieces.map((p) => p.z)) + 1;
  const slots = shuffle(
    loosePieces.map((_, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      return {
        x: col * (layout.pieceWidth + gap * 2) + rng() * gap,
        y: layout.boardHeight + gap + row * (layout.pieceHeight + gap * 2) + rng() * gap,
      };
    }),
    rng,
  );
  const randomizedPieces = shuffleAvoidingOriginalOrder(loosePieces, rng);
  const arrangedById = new Map<number, BoardPiece>();

  randomizedPieces.forEach((piece, index) => {
    const slot = slots[index]!;
    arrangedById.set(piece.id, {
      ...piece,
      x: slot.x,
      y: slot.y,
      z: nextTopZ + index + 1,
    });
  });

  return pieces.map((piece) => {
    if (piece.locked) return piece;
    return arrangedById.get(piece.id) ?? piece;
  });
}

function areSnappedNeighbors(a: BoardPiece, b: BoardPiece, layout: PuzzleLayout, tolerance: number): boolean {
  if (!areLayoutNeighbors(a.id, b.id, layout)) return false;
  const expectedDeltaX = a.targetX - b.targetX;
  const expectedDeltaY = a.targetY - b.targetY;
  return Math.hypot(a.x - b.x - expectedDeltaX, a.y - b.y - expectedDeltaY) <= tolerance;
}

function areLayoutNeighbors(aId: number, bId: number, layout: PuzzleLayout): boolean {
  const a = layout.pieces[aId];
  const b = layout.pieces[bId];
  if (!a || !b || a.id !== aId || b.id !== bId) return false;
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const shuffled = items.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

function shuffleAvoidingOriginalOrder<T>(items: T[], rng: () => number): T[] {
  const shuffled = shuffle(items, rng);
  if (shuffled.length > 1 && shuffled.every((item, index) => item === items[index])) {
    [shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
  }
  return shuffled;
}
