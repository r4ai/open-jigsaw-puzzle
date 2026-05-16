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

export function arrangeLoosePieces(pieces: BoardPiece[], layout: PuzzleLayout): BoardPiece[] {
  const gap = Math.max(8, Math.min(layout.pieceWidth, layout.pieceHeight) * 0.12);
  const columns = Math.max(1, layout.cols);
  const nextTopZ = Math.max(0, ...pieces.map((p) => p.z)) + 1;
  let index = 0;
  return pieces.map((piece) => {
    if (piece.locked) return piece;
    const col = index % columns;
    const row = Math.floor(index / columns);
    index++;
    return {
      ...piece,
      x: col * (layout.pieceWidth + gap),
      y: layout.boardHeight + gap + row * (layout.pieceHeight + gap),
      z: nextTopZ + index,
    };
  });
}
