import { onCleanup } from "solid-js";
import { snapPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { BoardPiece, PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import {
  addPieceRangeSelection,
  getConnectedLoosePieceIds,
  selectOnlyImageOverlay,
  selectOnlyPiece,
  snapLoosePiecesToNeighbors,
  toggleImageOverlaySelection,
  togglePieceSelection,
  type SelectionState,
} from "../../utils/puzzle-ops";
import {
  TOUCH_DRAG_THRESHOLD_PX,
  type BatchedPieceLock,
  type BatchedPieceMove,
  type DragState,
  type PendingDragMove,
} from "./types";

type Pointer = { x: number; y: number };
type GetPoint = (e: PointerEvent) => Pointer | null;

type Deps = {
  broadcast: (msg: ChannelMessage) => void;
  myId: () => string | null;
  layout: () => PuzzleLayout | null;
  getPieces: () => BoardPiece[];
  updatePieces: (updater: (current: BoardPiece[]) => BoardPiece[]) => void;
  constrainPosition: (pieceId: number, x: number, y: number) => Pointer;
  bringToFront: (pieceId: number) => number;
  bringSelectionToFront: (pieceIds: Set<number>) => void;
  currentSelection: () => SelectionState;
  setSelection: (next: SelectionState) => void;
  rememberMove: (startPieces: Map<number, BoardPiece>, nextPieces: BoardPiece[]) => void;
};

/**
 * Owns the pointer-drag finite state machine: the active {@link DragState}, the
 * live DOM transforms applied directly to piece elements during a drag (to
 * bypass reactive batching), and the animation-frame coalescing of moves. On
 * release it snaps to neighbours/targets, broadcasts the result, and records an
 * undo entry.
 */
export function useDrag(deps: Deps) {
  let dragging: DragState | null = null;
  let pendingDragMove: PendingDragMove | null = null;
  let dragFrame: number | null = null;
  let dragMargin = 0;
  const pieceElements = new Map<number, HTMLElement>();
  const livePieceTransforms = new Map<number, Pointer>();

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

  function publishPieceMoves(moves: BatchedPieceMove[]) {
    const by = deps.myId() ?? "local";
    if (moves.length === 0) return;
    if (moves.length === 1) {
      const move = moves[0]!;
      deps.broadcast({ type: "piece-move", ...move, by });
      return;
    }
    deps.broadcast({ type: "piece-moves", moves, by });
  }

  function publishPieceLocks(locks: BatchedPieceLock[]) {
    const by = deps.myId() ?? "local";
    if (locks.length === 0) return;
    if (locks.length === 1) {
      const lock = locks[0]!;
      deps.broadcast({ type: "piece-lock", ...lock, by });
      return;
    }
    deps.broadcast({ type: "piece-locks", locks, by });
  }

  function handlePointerDown(
    event: PointerEvent,
    piece: BoardPiece,
    getPoint: GetPoint,
    margin: number,
  ) {
    if (event.button !== 0) return;
    if (dragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    dragMargin = margin;
    const selectionBefore = deps.currentSelection();
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
    deps.setSelection(nextSelection);

    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const basePieceIds = nextSelection.pieceIds.size ? nextSelection.pieceIds : new Set([piece.id]);
    const currentLayout = deps.layout();
    const activePieceIds = currentLayout && !piece.locked
      ? getConnectedLoosePieceIds(deps.getPieces(), basePieceIds, currentLayout)
      : basePieceIds;
    if (activePieceIds.size > 1) deps.bringSelectionToFront(activePieceIds);
    else {
      const nextZ = deps.bringToFront(piece.id);
      deps.broadcast({ type: "piece-front", pieceId: piece.id, z: nextZ, by: deps.myId() ?? "local" });
    }

    if (piece.locked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pointer = getPoint(event);
    if (!pointer) return;
    const startPieces = collectStartPieces(activePieceIds);
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

  function handleImageOverlayPointerDown(event: PointerEvent, getPoint: GetPoint) {
    if (event.button !== 0) return;
    if (dragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const selectionBefore = deps.currentSelection();
    let nextSelection: SelectionState;
    if (event.ctrlKey || event.metaKey) {
      nextSelection = toggleImageOverlaySelection(selectionBefore);
    } else {
      nextSelection = selectionBefore.imageOverlaySelected ? selectionBefore : selectOnlyImageOverlay();
    }
    deps.setSelection(nextSelection);
    event.preventDefault();
    event.stopPropagation();

    const pointer = getPoint(event);
    if (!pointer) return;
    const startPieces = collectStartPieces(nextSelection.pieceIds);
    if (startPieces.size) {
      deps.bringSelectionToFront(nextSelection.pieceIds);
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

  function collectStartPieces(pieceIds: Iterable<number>): Map<number, BoardPiece> {
    const startPieces = new Map<number, BoardPiece>();
    const pieceById = new Map(deps.getPieces().map((currentPiece) => [currentPiece.id, currentPiece]));
    for (const id of pieceIds) {
      const selectedPiece = pieceById.get(id);
      if (selectedPiece) startPieces.set(id, selectedPiece);
    }
    return startPieces;
  }

  function handleDragMove(
    event: PointerEvent,
    getPoint: GetPoint,
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
      const constrained = deps.constrainPosition(id, startPiece.x + deltaX, startPiece.y + deltaY);
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
    deps.updatePieces((cur) => {
      const withLive = live.size === 0
        ? cur
        : cur.map((p) => {
            const lp = live.get(p.id);
            return lp && !p.locked ? { ...p, x: lp.x, y: lp.y } : p;
          });

      const movedPieceIds = new Set(ended.pieceIds);
      const currentLayout = deps.layout();
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
      deps.rememberMove(ended.startPieces, next);
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

  return {
    registerPieceElement,
    handlePointerDown,
    handleImageOverlayPointerDown,
    handleDragMove,
    handleDragEnd,
    cancelDrag,
    isDragging: () => dragging !== null,
  };
}
