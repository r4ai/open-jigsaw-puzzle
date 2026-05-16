import { useRef, useState } from "react";
import { clamp, roundZoom, shouldStartViewportPan } from "../utils/puzzle-ops";

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.15;
const WHEEL_ZOOM_FACTOR = 1.12;

export type PanOffset = { x: number; y: number };
type PanState = { pointerId: number; startX: number; startY: number; panX: number; panY: number };

export function useViewport() {
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });
  const [panning, setPanning] = useState<PanState | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);

  function getWorkspacePoint(event: React.PointerEvent): { x: number; y: number } | null {
    const world = worldRef.current;
    if (!world) return null;
    const rect = viewportRef.current?.getBoundingClientRect() ?? world.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
  }

  function zoomAtClientPoint(nextZoom: number, clientX: number, clientY: number) {
    const viewport = viewportRef.current;
    if (!viewport || nextZoom === zoom) return;
    const rect = viewport.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const wx = (vx - pan.x) / zoom;
    const wy = (vy - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({ x: vx - wx * nextZoom, y: vy - wy * nextZoom });
  }

  function changeZoom(delta: number) {
    const viewport = viewportRef.current;
    const nextZoom = clamp(roundZoom(zoom + delta), MIN_ZOOM, MAX_ZOOM);
    if (!viewport) {
      setZoom(nextZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomAtClientPoint(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function resetZoom() {
    setZoom(0.8);
    setPan({ x: 0, y: 0 });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    zoomAtClientPoint(clamp(roundZoom(zoom * factor), MIN_ZOOM, MAX_ZOOM), event.clientX, event.clientY);
  }

  function handleViewportPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!shouldStartViewportPan(event.button, event.target)) return;
    if (!viewportRef.current) return;
    setPanning({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePanMove(event: React.PointerEvent): boolean {
    if (!panning) return false;
    setPan({
      x: panning.panX + event.clientX - panning.startX,
      y: panning.panY + event.clientY - panning.startY,
    });
    event.preventDefault();
    return true;
  }

  function handlePanEnd(): boolean {
    if (!panning) return false;
    setPanning(null);
    return true;
  }

  return {
    zoom,
    pan,
    panning,
    viewportRef,
    worldRef,
    getWorkspacePoint,
    changeZoom,
    resetZoom,
    handleWheel,
    handleViewportPointerDown,
    handlePanMove,
    handlePanEnd,
  };
}
