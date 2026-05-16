import { useRef, useState } from "react";
import type { ChannelMessage } from "@open-puzzle/shared/protocol";
import type { PuzzleLayout } from "@open-puzzle/shared/puzzle";

type Position = { x: number; y: number };
type DragState = { startX: number; startY: number; originX: number; originY: number };

type Props = {
  broadcast: (msg: ChannelMessage) => void;
};

export function useImageOverlay({ broadcast }: Props) {
  const [position, setPosition] = useState<Position | null>(null);
  const positionRef = useRef<Position | null>(null);
  const draggingRef = useRef<DragState | null>(null);
  const broadcastRef = useRef(broadcast);
  broadcastRef.current = broadcast;

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
    const pointer = getPoint(event);
    if (!pointer || !positionRef.current) return;
    draggingRef.current = {
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
    const pointer = getPoint(event);
    if (!pointer) return;
    const pos = {
      x: dragging.originX + pointer.x - dragging.startX,
      y: dragging.originY + pointer.y - dragging.startY,
    };
    positionRef.current = pos;
    setPosition(pos);
    broadcastRef.current({ type: "image-overlay", x: pos.x, y: pos.y });
  }

  function moveBy(deltaX: number, deltaY: number) {
    const current = positionRef.current;
    if (!current) return;
    const pos = { x: current.x + deltaX, y: current.y + deltaY };
    positionRef.current = pos;
    setPosition(pos);
    broadcastRef.current({ type: "image-overlay", x: pos.x, y: pos.y });
  }

  function handleDragEnd() {
    draggingRef.current = null;
  }

  function handleMessage(_from: string, msg: ChannelMessage) {
    if (msg.type !== "image-overlay") return;
    const pos = { x: msg.x, y: msg.y };
    positionRef.current = pos;
    setPosition(pos);
  }

  function broadcastCurrentPosition() {
    if (positionRef.current) {
      broadcastRef.current({ type: "image-overlay", x: positionRef.current.x, y: positionRef.current.y });
    }
  }

  return {
    position,
    draggingRef,
    initPosition,
    handlePointerDown,
    handleDragMove,
    moveBy,
    handleDragEnd,
    handleMessage,
    broadcastCurrentPosition,
  };
}
