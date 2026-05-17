import { useRef, useState } from "react";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";

type Position = { x: number; y: number };
type DragState = { pointerId: number; startX: number; startY: number; originX: number; originY: number };

type Props = {
  broadcast: (msg: ChannelMessage) => void;
};

export function useImageOverlay({ broadcast }: Props) {
  const [position, setPosition] = useState<Position | null>(null);
  const [locked, setLocked] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const positionRef = useRef<Position | null>(null);
  const lockedRef = useRef(false);
  const opacityRef = useRef(1);
  const draggingRef = useRef<DragState | null>(null);
  const broadcastRef = useRef(broadcast);
  broadcastRef.current = broadcast;

  function broadcast_({ x, y }: Position) {
    broadcastRef.current({ type: "image-overlay", x, y, locked: lockedRef.current, opacity: opacityRef.current });
  }

  function initPosition(layout: PuzzleLayout) {
    if (positionRef.current) return;
    const pos = { x: layout.boardWidth + 20, y: 0 };
    positionRef.current = pos;
    setPosition(pos);
  }

  function handlePointerDown(
    event: React.PointerEvent,
    getPoint: (e: React.PointerEvent) => Position | null,
  ) {
    if (lockedRef.current) return;
    if (draggingRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const pointer = getPoint(event);
    if (!pointer || !positionRef.current) return;
    draggingRef.current = {
      pointerId: event.pointerId,
      startX: pointer.x,
      startY: pointer.y,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDragMove(
    event: React.PointerEvent,
    getPoint: (e: React.PointerEvent) => Position | null,
  ) {
    const dragging = draggingRef.current;
    if (!dragging) return;
    if (event.pointerId !== dragging.pointerId) return;
    const pointer = getPoint(event);
    if (!pointer) return;
    const pos = {
      x: dragging.originX + pointer.x - dragging.startX,
      y: dragging.originY + pointer.y - dragging.startY,
    };
    positionRef.current = pos;
    setPosition(pos);
    broadcast_(pos);
  }

  function moveBy(deltaX: number, deltaY: number) {
    const current = positionRef.current;
    if (!current) return;
    const pos = { x: current.x + deltaX, y: current.y + deltaY };
    positionRef.current = pos;
    setPosition(pos);
    broadcast_(pos);
  }

  function handleDragEnd(pointerId?: number) {
    const dragging = draggingRef.current;
    if (pointerId !== undefined && dragging && pointerId !== dragging.pointerId) return;
    draggingRef.current = null;
  }

  function toggleLock() {
    const next = !lockedRef.current;
    lockedRef.current = next;
    setLocked(next);
    if (positionRef.current) broadcast_(positionRef.current);
  }

  function changeOpacity(value: number) {
    const next = Math.max(0, Math.min(1, value));
    opacityRef.current = next;
    setOpacity(next);
    if (positionRef.current) broadcast_(positionRef.current);
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    if (msg.type !== "image-overlay") return;
    const pos = { x: msg.x, y: msg.y };
    positionRef.current = pos;
    setPosition(pos);
    lockedRef.current = msg.locked;
    setLocked(msg.locked);
    opacityRef.current = msg.opacity;
    setOpacity(msg.opacity);
  }

  function broadcastCurrentPosition() {
    if (positionRef.current) broadcast_(positionRef.current);
  }

  return {
    position,
    locked,
    opacity,
    draggingRef,
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
