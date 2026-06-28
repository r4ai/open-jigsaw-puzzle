import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import type { RemoteSelection } from "./puzzle/types";
import { createRealtimeSync } from "./puzzle/realtime-sync";
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
 * The core puzzle hook. Composes focused sub-hooks — the piece store, the
 * completion timer, undo/redo history, selection, and the drag FSM — and the
 * realtime message dispatcher, exposing them behind a single flat API. This
 * hook is wiring only; behaviour lives in the modules under `./puzzle`.
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
    constrainPosition,
    bringToFront,
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

  const { handleMessage } = createRealtimeSync({
    myId: props.myId,
    constrainPosition: store.constrainPosition,
    updatePieces: store.updatePieces,
    applySyncedPieces: store.applySyncedPieces,
    bumpRemoteVersion: history.bumpRemoteVersion,
    onPieceMoved: props.onPieceMoved,
    onPieceLocked: props.onPieceLocked,
    setStartedAtMsIfUnset: timer.setStartedAtMsIfUnset,
    markCleared: timer.markCleared,
    upsertRemoteSelection: selection.upsertRemoteSelection,
  });

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
