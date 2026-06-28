import { createMemo, createSignal } from "solid-js";
import {
  createInitialPieces,
  isComplete,
} from "@open-jigsaw-puzzle/shared/puzzle";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage, SyncedPiece } from "@open-jigsaw-puzzle/shared/protocol";
import {
  arrangeLoosePieces,
  bringSelectedPiecesToFront,
  countLockedPieces,
  MAX_CANVAS_COORDINATE,
  mergeSyncedPieces,
  updatePieceById,
} from "../../utils/puzzle-ops";

type Deps = {
  broadcast: (msg: ChannelMessage) => void;
  myId: () => string | null;
  /** Current host-confirmed start time, broadcast alongside organize syncs. */
  getStartedAtMs: () => number | null;
  resetTimer: () => void;
  clearMoveHistory: (resetRemoteVersion?: boolean) => void;
};

/**
 * Owns the board's piece array and is the *only* place that maintains the
 * `pieces` signal / `piecesNow` mirror / `pendingSync` buffer. Every mutation
 * flows through {@link updatePieces}, so the signal and its synchronous mirror
 * can never drift. Consumers read via {@link getPieces} and mutate only through
 * the returned commands.
 */
export function usePieceStore(deps: Deps) {
  const [pieces, setPieces] = createSignal<BoardPiece[]>([]);
  let piecesNow: BoardPiece[] = [];
  let pendingSync: SyncedPiece[] | null = null;

  /** The single write path: keeps `piecesNow` in lockstep with the signal. */
  function updatePieces(updater: (current: BoardPiece[]) => BoardPiece[]) {
    setPieces((current) => {
      const next = updater(current);
      piecesNow = next;
      return next;
    });
  }

  const getPieces = () => piecesNow;

  function constrainPosition(pieceId: number, x: number, y: number): { x: number; y: number } {
    if (
      !Number.isFinite(x) || !Number.isFinite(y) ||
      Math.abs(x) > MAX_CANVAS_COORDINATE || Math.abs(y) > MAX_CANVAS_COORDINATE
    ) {
      const fallback = piecesNow[pieceId];
      return { x: fallback?.x ?? 0, y: fallback?.y ?? 0 };
    }
    return { x, y };
  }

  function broadcastStateSync(next: BoardPiece[]) {
    const synced = next.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
    deps.broadcast({
      type: "state-sync",
      pieces: synced,
      lockedCount: countLockedPieces(synced),
      by: deps.myId() ?? "local",
      startedAtMs: deps.getStartedAtMs(),
    });
  }

  function bringToFront(pieceId: number): number {
    const nextZ = Math.max(0, ...piecesNow.map((p) => p.z)) + 1;
    updatePieces((current) => updatePieceById(current, pieceId, (p) => ({ ...p, z: nextZ })));
    return nextZ;
  }

  function bringSelectionToFront(pieceIds: Set<number>) {
    const before = piecesNow;
    const next = bringSelectedPiecesToFront(before, pieceIds);
    if (next === before) return;
    updatePieces(() => next);
    const beforeById = new Map(before.map((piece) => [piece.id, piece]));
    for (const piece of next) {
      const previous = beforeById.get(piece.id);
      if (previous && previous.z !== piece.z) {
        deps.broadcast({ type: "piece-front", pieceId: piece.id, z: piece.z, by: deps.myId() ?? "local" });
      }
    }
  }

  function setNewPieces(newLayout: PuzzleLayout) {
    const nextPieces = createInitialPieces(newLayout);
    pendingSync = null;
    deps.clearMoveHistory(true);
    deps.resetTimer();
    updatePieces(() => nextPieces);
  }

  function receiveImage(nextLayout: PuzzleLayout) {
    updatePieces(() => {
      const base = createInitialPieces(nextLayout);
      const pending = pendingSync;
      pendingSync = null;
      deps.clearMoveHistory(true);
      deps.resetTimer();
      if (!pending) return base;
      const constrained = pending.map((p) => {
        const { x, y } = constrainPosition(p.id, p.x, p.y);
        return { ...p, x, y };
      });
      return mergeSyncedPieces(base, constrained);
    });
  }

  function applySyncedPieces(synced: SyncedPiece[]) {
    const constrained = synced.map((p) => {
      const { x, y } = constrainPosition(p.id, p.x, p.y);
      return { ...p, x, y };
    });
    updatePieces((current) => {
      if (!current.length) {
        pendingSync = constrained;
        return current;
      }
      pendingSync = null;
      return mergeSyncedPieces(current, constrained);
    });
  }

  function organizePieces(currentLayout: PuzzleLayout) {
    deps.clearMoveHistory();
    updatePieces((current) => {
      const next = arrangeLoosePieces(current, currentLayout);
      broadcastStateSync(next);
      return next;
    });
  }

  return {
    pieces,
    getPieces,
    updatePieces,
    constrainPosition,
    bringToFront,
    bringSelectionToFront,
    setNewPieces,
    receiveImage,
    applySyncedPieces,
    organizePieces,
    complete: createMemo(() => isComplete(pieces())),
    lockedCount: createMemo(() => countLockedPieces(pieces())),
  };
}
