import { onCleanup } from "solid-js";
import { snapPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type {
  BoardPiece,
  PuzzleLayout,
} from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import {
  getConnectedLoosePieceIds,
  selectOnlyImageOverlay,
  selectOnlyPiece,
  snapLoosePiecesToNeighbors,
  toggleImageOverlaySelection,
  togglePieceSelection,
  addPieceRangeSelection,
} from "../utils/puzzle-ops";
import type { SelectionState } from "../utils/puzzle-ops";
import {
  TOUCH_DRAG_THRESHOLD_PX,
  type BatchedPieceLock,
  type BatchedPieceMove,
  type DragState,
  type PendingDragMove,
  type RemoteSelection,
} from "./puzzle/types";
import { reduceMessage, type SyncCommand } from "./puzzle/message-reducer";
import { usePieceStore } from "./puzzle/use-piece-store";
import { useCompletionTimer } from "./puzzle/use-completion-timer";
import { usePuzzleHistory } from "./puzzle/use-puzzle-history";
import { useSelection } from "./puzzle/use-selection";

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
  let dragging: DragState | null = null;
  let pendingDragMove: PendingDragMove | null = null;
  let dragFrame: number | null = null;
  const pieceElements = new Map<number, HTMLElement>();
  const livePieceTransforms = new Map<number, { x: number; y: number }>();
  let dragMargin = 0;
  onCleanup(() => {
    if (dragFrame !== null) cancelAnimationFrame(dragFrame);
  });

  function registerPieceElement(id: number, el: HTMLElement | null) {
    if (el) pieceElements.set(id, el);
    else pieceElements.delete(id);
  }

  function setPieceDomTransform(id: number, x: number, y: number) {
    const el = pieceElements.get(id);
    if (!el) return;
    el.style.transform = `translate3d(${dragMargin + x}px, ${dragMargin + y}px, 0)`;
  }

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
  const {
    setSelection,
    clearSelection,
    currentSelection,
    handleSelectionBoxPointerDown,
    handleSelectionBoxMove,
    handleSelectionBoxEnd,
    upsertRemoteSelection,
    removeRemoteSelection,
  } = selection;

  function publishPieceMoves(moves: BatchedPieceMove[]) {
    const by = props.myId() ?? "local";
    if (moves.length === 0) return;
    if (moves.length === 1) {
      const move = moves[0]!;
      props.broadcast({ type: "piece-move", ...move, by });
      return;
    }
    props.broadcast({ type: "piece-moves", moves, by });
  }

  function publishPieceLocks(locks: BatchedPieceLock[]) {
    const by = props.myId() ?? "local";
    if (locks.length === 0) return;
    if (locks.length === 1) {
      const lock = locks[0]!;
      props.broadcast({ type: "piece-lock", ...lock, by });
      return;
    }
    props.broadcast({ type: "piece-locks", locks, by });
  }

  function handlePointerDown(
    event: PointerEvent,
    piece: BoardPiece,
    getPoint: (e: PointerEvent) => { x: number; y: number } | null,
    margin: number,
  ) {
    if (event.button !== 0) return;
    if (dragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    dragMargin = margin;
    const selectionBefore = currentSelection();
    let nextSelection: SelectionState;
    if (event.shiftKey) {
      nextSelection = addPieceRangeSelection(selectionBefore, piece.id);
    } else if (event.ctrlKey || event.metaKey) {
      nextSelection = togglePieceSelection(selectionBefore, piece.id);
    } else if (selectionBefore.pieceIds.has(piece.id)) {
      nextSelection = selectionBefore;
    } else {
      nextSelection = selectOnlyPiece(piece.id);
    }
    setSelection(nextSelection);

    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const basePieceIds = nextSelection.pieceIds.size ? nextSelection.pieceIds : new Set([piece.id]);
    const currentLayout = props.layout();
    const activePieceIds = currentLayout && !piece.locked
      ? getConnectedLoosePieceIds(getPieces(), basePieceIds, currentLayout)
      : basePieceIds;
    if (activePieceIds.size > 1) bringSelectionToFront(activePieceIds);
    else {
      const nextZ = bringToFront(piece.id);
      props.broadcast({ type: "piece-front", pieceId: piece.id, z: nextZ, by: props.myId() ?? "local" });
    }

    if (piece.locked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pointer = getPoint(event);
    if (!pointer) return;
    const startPieces = new Map<number, BoardPiece>();
    const pieceById = new Map(getPieces().map((currentPiece) => [currentPiece.id, currentPiece]));
    for (const id of activePieceIds) {
      const selectedPiece = pieceById.get(id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    dragging = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startClient: { x: event.clientX, y: event.clientY },
      pieceIds: [...activePieceIds],
      startPointer: pointer,
      startPieces,
      committed: event.pointerType !== "touch",
      lastDeltaX: 0,
      lastDeltaY: 0,
      moveImageOverlay: nextSelection.imageOverlaySelected,
    };
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleImageOverlayPointerDown(
    event: PointerEvent,
    getPoint: (e: PointerEvent) => { x: number; y: number } | null,
  ) {
    if (event.button !== 0) return;
    if (dragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const selectionBefore = currentSelection();
    let nextSelection: SelectionState;
    if (event.ctrlKey || event.metaKey) {
      nextSelection = toggleImageOverlaySelection(selectionBefore);
    } else {
      nextSelection = selectionBefore.imageOverlaySelected ? selectionBefore : selectOnlyImageOverlay();
    }
    setSelection(nextSelection);
    event.preventDefault();
    event.stopPropagation();

    const pointer = getPoint(event);
    if (!pointer) return;
    const startPieces = new Map<number, BoardPiece>();
    const pieceById = new Map(getPieces().map((currentPiece) => [currentPiece.id, currentPiece]));
    for (const id of nextSelection.pieceIds) {
      const selectedPiece = pieceById.get(id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    if (startPieces.size) {
      bringSelectionToFront(nextSelection.pieceIds);
      dragging = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startClient: { x: event.clientX, y: event.clientY },
        pieceIds: [...nextSelection.pieceIds],
        startPointer: pointer,
        startPieces,
        committed: event.pointerType !== "touch",
        lastDeltaX: 0,
        lastDeltaY: 0,
        moveImageOverlay: false,
      };
    }
  }

  function handleDragMove(
    event: PointerEvent,
    getPoint: (e: PointerEvent) => { x: number; y: number } | null,
    margin: number,
    onImageOverlayDelta?: (deltaX: number, deltaY: number) => void,
  ) {
    if (!dragging) return;
    if (event.pointerId !== dragging.pointerId) return;
    const pointer = getPoint(event);
    if (!pointer) return;
    if (!dragging.committed) {
      const clientDistance = Math.hypot(
        event.clientX - dragging.startClient.x,
        event.clientY - dragging.startClient.y,
      );
      if (dragging.pointerType === "touch" && clientDistance < TOUCH_DRAG_THRESHOLD_PX) {
        event.preventDefault();
        return;
      }
      dragging.committed = true;
    }
    dragMargin = margin;
    const deltaX = pointer.x - dragging.startPointer.x;
    const deltaY = pointer.y - dragging.startPointer.y;
    scheduleDragMove({ deltaX, deltaY, onImageOverlayDelta });
    event.preventDefault();
  }

  function scheduleDragMove(move: PendingDragMove) {
    pendingDragMove = move;
    if (dragFrame !== null) return;
    dragFrame = requestAnimationFrame(() => {
      dragFrame = null;
      flushPendingDragMove();
    });
  }

  function flushPendingDragMove() {
    const move = pendingDragMove;
    pendingDragMove = null;
    if (!move) return;
    applyDragMove(move.deltaX, move.deltaY, move.onImageOverlayDelta);
  }

  function applyDragMove(
    deltaX: number,
    deltaY: number,
    onImageOverlayDelta?: (deltaX: number, deltaY: number) => void,
  ) {
    if (!dragging) return;
    const moves: BatchedPieceMove[] = [];
    for (const id of dragging.pieceIds) {
      const startPiece = dragging.startPieces.get(id);
      if (!startPiece || startPiece.locked) continue;
      const constrained = constrainPosition(id, startPiece.x + deltaX, startPiece.y + deltaY);
      livePieceTransforms.set(id, constrained);
      setPieceDomTransform(id, constrained.x, constrained.y);
      moves.push({ pieceId: id, x: constrained.x, y: constrained.y, z: startPiece.z });
    }
    publishPieceMoves(moves);
    if (dragging.moveImageOverlay && onImageOverlayDelta) {
      onImageOverlayDelta(deltaX - dragging.lastDeltaX, deltaY - dragging.lastDeltaY);
    }
    dragging.lastDeltaX = deltaX;
    dragging.lastDeltaY = deltaY;
  }

  function handleDragEnd(threshold: number, pointerId?: number) {
    if (!dragging) return;
    if (pointerId !== undefined && pointerId !== dragging.pointerId) return;
    const ended = dragging;
    if (dragFrame !== null) {
      cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
    flushPendingDragMove();
    dragging = null;
    if (!ended.committed) {
      livePieceTransforms.clear();
      return;
    }
    const live = new Map(livePieceTransforms);
    livePieceTransforms.clear();
    updatePieces((cur) => {
      const withLive = live.size === 0
        ? cur
        : cur.map((p) => {
            const lp = live.get(p.id);
            return lp && !p.locked ? { ...p, x: lp.x, y: lp.y } : p;
          });

      const movedPieceIds = new Set(ended.pieceIds);
      const currentLayout = props.layout();
      const neighborSnapped = currentLayout
        ? snapLoosePiecesToNeighbors(withLive, movedPieceIds, currentLayout, threshold)
        : withLive;

      const moves: BatchedPieceMove[] = [];
      const locks: BatchedPieceLock[] = [];
      const next = neighborSnapped.map((piece) => {
        if (!ended.startPieces.has(piece.id) || piece.locked) return piece;
        const snapped = snapPiece(piece, threshold);
        if (snapped.locked) {
          locks.push({ pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z });
        } else {
          const previous = withLive.find((candidate) => candidate.id === snapped.id);
          if (previous && (previous.x !== snapped.x || previous.y !== snapped.y)) {
            moves.push({ pieceId: snapped.id, x: snapped.x, y: snapped.y, z: snapped.z });
          }
        }
        return snapped;
      });
      publishPieceLocks(locks);
      publishPieceMoves(moves);
      rememberMove(ended.startPieces, next);
      return next;
    });
  }

  function cancelDrag(pointerId?: number): boolean {
    if (!dragging) return false;
    if (pointerId !== undefined && pointerId !== dragging.pointerId) return false;
    const canceled = dragging;
    if (dragFrame !== null) {
      cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
    pendingDragMove = null;
    dragging = null;

    const rollbacks: BatchedPieceMove[] = [];
    for (const [id, startPiece] of canceled.startPieces) {
      livePieceTransforms.delete(id);
      setPieceDomTransform(id, startPiece.x, startPiece.y);
      if (canceled.committed) {
        rollbacks.push({ pieceId: id, x: startPiece.x, y: startPiece.y, z: startPiece.z });
      }
    }
    livePieceTransforms.clear();
    publishPieceMoves(rollbacks);
    return true;
  }

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
        upsertRemoteSelection(command.selection);
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
    isDragging: () => dragging !== null,
    constrainPosition,
    bringToFront,
    setNewPieces,
    receiveImage,
    applySyncedPieces,
    organizePieces,
    clearSelection,
    cancelDrag,
    handlePointerDown,
    handleImageOverlayPointerDown,
    handleDragMove,
    handleDragEnd,
    undoLastMove,
    redoLastMove,
    clearMoveHistory,
    handleSelectionBoxPointerDown,
    handleSelectionBoxMove,
    handleSelectionBoxEnd,
    handleMessage,
    removeRemoteSelection,
    registerPieceElement,
  };
}
