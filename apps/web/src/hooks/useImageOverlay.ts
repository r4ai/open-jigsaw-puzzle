import { createSignal } from "solid-js";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";

type Position = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; originX: number; originY: number };

type Props = {
  broadcast: (msg: ChannelMessage) => void;
};

export function useImageOverlay({ broadcast }: Props) {
  const [position, setPosition] = createSignal<Position | null>(null);
  const [locked, setLocked] = createSignal(false);
  const [opacity, setOpacity] = createSignal(1);
  let positionNow: Position | null = null;
  let lockedNow = false;
  let opacityNow = 1;
  let dragging: DragState | null = null;

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
    commitPosition(pos);
    broadcast_(pos);
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
    dragging = null;
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
    toggleLock,
    changeOpacity,
    handleMessage,
    broadcastCurrentPosition,
  };
}
