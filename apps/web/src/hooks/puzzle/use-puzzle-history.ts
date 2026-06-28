import type { BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { countLockedPieces } from "../../utils/puzzle-ops";
import {
  applyPieceSnapshots,
  createMoveHistoryEntry,
  createPieceHistory,
  type HistoryResult,
  type PieceHistorySnapshot,
} from "../../utils/puzzle-history";

type Deps = {
  broadcast: (msg: ChannelMessage) => void;
  myId: () => string | null;
  getStartedAtMs: () => number | null;
  updatePieces: (updater: (current: BoardPiece[]) => BoardPiece[]) => void;
};

/**
 * Owns the local undo/redo stacks and the `remoteMoveVersion` counter that
 * guards them: an undo/redo is only valid while no remote move has landed since
 * the entry was recorded, so concurrent edits can't be silently clobbered.
 */
export function usePuzzleHistory(deps: Deps) {
  const history = createPieceHistory();
  let remoteMoveVersion = 0;

  /** Advance the version when a remote edit arrives, invalidating stale history. */
  function bumpRemoteVersion() {
    remoteMoveVersion += 1;
  }

  function rememberMove(startPieces: Map<number, BoardPiece>, nextPieces: BoardPiece[]) {
    history.remember(createMoveHistoryEntry(startPieces.values(), nextPieces, remoteMoveVersion));
  }

  function applyHistorySnapshots(snapshots: PieceHistorySnapshot[]) {
    deps.updatePieces((current) => {
      const next = applyPieceSnapshots(current, snapshots);
      const synced = next.map(({ id, x, y, z, locked }) => ({ id, x, y, z, locked }));
      deps.broadcast({
        type: "state-sync",
        pieces: synced,
        lockedCount: countLockedPieces(synced),
        by: deps.myId() ?? "local",
        startedAtMs: deps.getStartedAtMs(),
      });
      return next;
    });
  }

  function undoLastMove(): HistoryResult {
    const { result, snapshots } = history.undo(remoteMoveVersion);
    if (result === "applied") applyHistorySnapshots(snapshots);
    return result;
  }

  function redoLastMove(): HistoryResult {
    const { result, snapshots } = history.redo(remoteMoveVersion);
    if (result === "applied") applyHistorySnapshots(snapshots);
    return result;
  }

  function clearMoveHistory(resetRemoteVersion = false) {
    history.clear();
    if (resetRemoteVersion) remoteMoveVersion = 0;
  }

  return { rememberMove, undoLastMove, redoLastMove, clearMoveHistory, bumpRemoteVersion };
}
