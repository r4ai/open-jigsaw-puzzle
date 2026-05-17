import type { BoardPiece } from "@open-puzzle/shared/puzzle";

export type PieceHistorySnapshot = Pick<BoardPiece, "id" | "x" | "y" | "z" | "locked">;
export type HistoryResult = "applied" | "blocked" | "empty";

type PieceHistoryEntry = {
  before: PieceHistorySnapshot[];
  after: PieceHistorySnapshot[];
  remoteMoveVersion: number;
};

export function pieceSnapshot(piece: BoardPiece): PieceHistorySnapshot {
  return { id: piece.id, x: piece.x, y: piece.y, z: piece.z, locked: piece.locked };
}

export function createMoveHistoryEntry(
  startPieces: Iterable<BoardPiece>,
  nextPieces: BoardPiece[],
  remoteMoveVersion: number,
): PieceHistoryEntry | null {
  const nextById = new Map(nextPieces.map((piece) => [piece.id, piece]));
  const before: PieceHistorySnapshot[] = [];
  const after: PieceHistorySnapshot[] = [];

  for (const startPiece of startPieces) {
    const nextPiece = nextById.get(startPiece.id);
    if (!nextPiece) continue;
    const startSnapshot = pieceSnapshot(startPiece);
    const nextSnapshot = pieceSnapshot(nextPiece);
    if (!snapshotsChanged(startSnapshot, nextSnapshot)) continue;
    before.push(startSnapshot);
    after.push(nextSnapshot);
  }

  return before.length ? { before, after, remoteMoveVersion } : null;
}

export function applyPieceSnapshots(pieces: BoardPiece[], snapshots: PieceHistorySnapshot[]): BoardPiece[] {
  const byId = new Map(snapshots.map((piece) => [piece.id, piece]));
  return pieces.map((piece) => {
    const snapshot = byId.get(piece.id);
    return snapshot ? { ...piece, x: snapshot.x, y: snapshot.y, z: snapshot.z, locked: snapshot.locked } : piece;
  });
}

export function createPieceHistory(limit = 100) {
  let undoStack: PieceHistoryEntry[] = [];
  let redoStack: PieceHistoryEntry[] = [];

  return {
    clear() {
      undoStack = [];
      redoStack = [];
    },
    remember(entry: PieceHistoryEntry | null) {
      if (!entry) return;
      undoStack = [...undoStack, entry].slice(-limit);
      redoStack = [];
    },
    undo(remoteMoveVersion: number): { result: HistoryResult; snapshots: PieceHistorySnapshot[] } {
      const entry = undoStack.at(-1);
      if (!entry) return { result: "empty", snapshots: [] };
      if (entry.remoteMoveVersion !== remoteMoveVersion) return { result: "blocked", snapshots: [] };
      undoStack = undoStack.slice(0, -1);
      redoStack = [...redoStack, entry];
      return { result: "applied", snapshots: entry.before };
    },
    redo(remoteMoveVersion: number): { result: HistoryResult; snapshots: PieceHistorySnapshot[] } {
      const entry = redoStack.at(-1);
      if (!entry) return { result: "empty", snapshots: [] };
      if (entry.remoteMoveVersion !== remoteMoveVersion) return { result: "blocked", snapshots: [] };
      redoStack = redoStack.slice(0, -1);
      undoStack = [...undoStack, entry];
      return { result: "applied", snapshots: entry.after };
    },
  };
}

function snapshotsChanged(a: PieceHistorySnapshot, b: PieceHistorySnapshot): boolean {
  return a.x !== b.x || a.y !== b.y || a.z !== b.z || a.locked !== b.locked;
}
