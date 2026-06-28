import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import type { RemoteSelection } from "./puzzle/types";
import { reduceMessage, type SyncCommand } from "./puzzle/message-reducer";
import { usePieceStore } from "./puzzle/use-piece-store";
import { useCompletionTimer } from "./puzzle/use-completion-timer";
import { usePuzzleHistory } from "./puzzle/use-puzzle-history";
import { useSelection } from "./puzzle/use-selection";
import { useDrag } from "./puzzle/use-drag";

export type { RemoteSelection };

type Props = {
  broadcast: (msg: ChannelMessage) => void;
  myId: () => string | null;
  isHost: () => boolean;
  layout: () => PuzzleLayout | null;
  onPieceMoved?: (participantId: string) => void;
  onPieceLocked?: (participantId: string) => void;
};

/**
 * The core puzzle hook: owns the piece array, selection state, drag handling,
 * undo/redo history, and the realtime message dispatcher that keeps every
 * participant's board consistent.
 */
export function usePuzzle(props: Props) {
  const timer = useCompletionTimer({
    broadcast: props.broadcast,
    myId: props.myId,
    isHost: props.isHost,
    pieces: () => store.pieces(),
    complete: () => store.complete(),
    getPieces: () => store.getPieces(),
  });

  const history = usePuzzleHistory({
    broadcast: props.broadcast,
    myId: props.myId,
    getStartedAtMs: timer.getStartedAtMs,
    updatePieces: (updater) => store.updatePieces(updater),
  });
  const { rememberMove, undoLastMove, redoLastMove, clearMoveHistory } = history;

  const store = usePieceStore({
    broadcast: props.broadcast,
    myId: props.myId,
    getStartedAtMs: timer.getStartedAtMs,
    resetTimer: timer.resetTimer,
    clearMoveHistory,
  });
  const {
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
    complete,
    lockedCount,
  } = store;

  const selection = useSelection({
    broadcast: props.broadcast,
    myId: props.myId,
    getPieces: () => store.getPieces(),
  });
  const { clearSelection, handleSelectionBoxPointerDown, handleSelectionBoxMove, handleSelectionBoxEnd } =
    selection;

  const drag = useDrag({
    broadcast: props.broadcast,
    myId: props.myId,
    layout: props.layout,
    getPieces: store.getPieces,
    updatePieces: store.updatePieces,
    constrainPosition: store.constrainPosition,
    bringToFront: store.bringToFront,
    bringSelectionToFront: store.bringSelectionToFront,
    currentSelection: selection.currentSelection,
    setSelection: selection.setSelection,
    rememberMove: history.rememberMove,
  });

  function runSyncCommand(command: SyncCommand) {
    switch (command.kind) {
      case "bumpRemoteVersion":
        history.bumpRemoteVersion();
        break;
      case "notifyMoved":
        props.onPieceMoved?.(command.by);
        break;
      case "notifyLocked":
        props.onPieceLocked?.(command.by);
        break;
      case "transformPieces":
        updatePieces(command.transform);
        break;
      case "applySynced":
        applySyncedPieces(command.pieces);
        break;
      case "setStartedAtMs":
        timer.setStartedAtMsIfUnset(command.startedAtMs);
        break;
      case "upsertRemoteSelection":
        selection.upsertRemoteSelection(command.selection);
        break;
      case "markCleared":
        timer.markCleared(command.elapsedMs);
        break;
    }
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    const commands = reduceMessage(msg, { myId: props.myId(), constrain: constrainPosition });
    for (const command of commands) runSyncCommand(command);
  }

  return {
    pieces,
    selectedPieceIds: selection.selectedPieceIds,
    imageOverlaySelected: selection.imageOverlaySelected,
    selectionBox: selection.selectionBox,
    remoteSelections: selection.remoteSelections,
    complete,
    clearedElapsedMs: timer.clearedElapsedMs,
    lockedCount,
    getPieces,
    getStartedAtMs: timer.getStartedAtMs,
    isDragging: drag.isDragging,
    constrainPosition,
    bringToFront,
    setNewPieces,
    receiveImage,
    applySyncedPieces,
    organizePieces,
    clearSelection,
    cancelDrag: drag.cancelDrag,
    handlePointerDown: drag.handlePointerDown,
    handleImageOverlayPointerDown: drag.handleImageOverlayPointerDown,
    handleDragMove: drag.handleDragMove,
    handleDragEnd: drag.handleDragEnd,
    undoLastMove,
    redoLastMove,
    clearMoveHistory,
    handleSelectionBoxPointerDown,
    handleSelectionBoxMove,
    handleSelectionBoxEnd,
    handleMessage,
    removeRemoteSelection: selection.removeRemoteSelection,
    registerPieceElement: drag.registerPieceElement,
  };
}
