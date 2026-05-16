import type { BoardPiece, PuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { SyncedPiece } from "@open-puzzle/shared/protocol";

export const MAX_CANVAS_COORDINATE = 1_000_000_000;

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
