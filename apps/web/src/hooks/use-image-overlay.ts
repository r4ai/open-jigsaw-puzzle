import { createSignal, onCleanup } from "solid-js";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";

type Position = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; originX: number; originY: number };

type Props = {
  broadcast: (msg: ChannelMessage) => void;
};

/**
 * Tracks the shared reference-image overlay: position, lock state, and
 * opacity, plus pointer-drag handling. State changes are broadcast so every
 * participant sees the same overlay.
 */
export function useImageOverlay({ broadcast }: Props) {
  const [position, setPosition] = createSignal<Position | null>(null);
  const [locked, setLocked] = createSignal(false);
  const [opacity, setOpacity] = createSignal(1);
  let positionNow: Position | null = null;
  let lockedNow = false;
  let opacityNow = 1;
  let dragging: DragState | null = null;
  let pendingDragPosition: Position | null = null;
  let dragFrame: number | null = null;

  onCleanup(() => {
    if (dragFrame !== null) cancelAnimationFrame(dragFrame);
  });

  function broadcast_({ x, y }: Position) {
    broadcast({ type: "image-overlay", x, y, locked: lockedNow, opacity: opacityNow });
  }

  function commitPosition(pos: Position) {
    positionNow = pos;
    setPosition(pos);
  }

  function initPosition(layout: PuzzleLayout) {
    if (positionNow) return;
    commitPosition({ x: layout.boardWidth + 20, y: 0 });
  }

  function handlePointerDown(event: PointerEvent, getPoint: (e: PointerEvent) => Position | null) {
    if (lockedNow) return;
    if (dragging) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pointer = getPoint(event);
    if (!pointer || !positionNow) return;
    dragging = {
      pointerId: event.pointerId,
      startX: pointer.x,
      startY: pointer.y,
      originX: positionNow.x,
      originY: positionNow.y,
    };
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragMove(event: PointerEvent, getPoint: (e: PointerEvent) => Position | null) {
    if (!dragging) return;
    if (event.pointerId !== dragging.pointerId) return;
    const pointer = getPoint(event);
    if (!pointer) return;
    const pos = {
      x: dragging.originX + pointer.x - dragging.startX,
      y: dragging.originY + pointer.y - dragging.startY,
    };
    scheduleDragPosition(pos);
  }

  function moveBy(deltaX: number, deltaY: number) {
    const current = positionNow;
    if (!current) return;
    const pos = { x: current.x + deltaX, y: current.y + deltaY };
    commitPosition(pos);
    broadcast_(pos);
  }

  function handleDragEnd(pointerId?: number) {
    if (pointerId !== undefined && dragging && pointerId !== dragging.pointerId) return;
    flushDragPosition();
    dragging = null;
  }

  function cancelDrag(pointerId?: number) {
    if (!dragging) return false;
    if (pointerId !== undefined && pointerId !== dragging.pointerId) return false;
    clearPendingDragPosition();
    const pos = { x: dragging.originX, y: dragging.originY };
    dragging = null;
    commitPosition(pos);
    broadcast_(pos);
    return true;
  }

  function scheduleDragPosition(pos: Position) {
    pendingDragPosition = pos;
    if (dragFrame !== null) return;
    dragFrame = requestAnimationFrame(() => {
      dragFrame = null;
      flushDragPosition();
    });
  }

  function flushDragPosition() {
    const pos = pendingDragPosition;
    pendingDragPosition = null;
    if (!pos) return;
    commitPosition(pos);
    broadcast_(pos);
  }

  function clearPendingDragPosition() {
    pendingDragPosition = null;
    if (dragFrame !== null) {
      cancelAnimationFrame(dragFrame);
      dragFrame = null;
    }
  }

  function toggleLock() {
    lockedNow = !lockedNow;
    setLocked(lockedNow);
    if (positionNow) broadcast_(positionNow);
  }

  function changeOpacity(value: number) {
    const next = Math.max(0, Math.min(1, value));
    opacityNow = next;
    setOpacity(next);
    if (positionNow) broadcast_(positionNow);
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    if (msg.type !== "image-overlay") return;
    commitPosition({ x: msg.x, y: msg.y });
    lockedNow = msg.locked;
    setLocked(msg.locked);
    opacityNow = msg.opacity;
    setOpacity(msg.opacity);
  }

  function broadcastCurrentPosition() {
    if (positionNow) broadcast_(positionNow);
  }

  return {
    position,
    locked,
    opacity,
    isDragging: () => dragging !== null,
    initPosition,
    handlePointerDown,
    handleDragMove,
    moveBy,
    handleDragEnd,
    cancelDrag,
    toggleLock,
    changeOpacity,
    handleMessage,
    broadcastCurrentPosition,
  };
}
