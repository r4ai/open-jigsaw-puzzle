import { useEffect, useRef, useState } from "react";
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
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const panningRef = useRef<PanState | null>(panning);
  const pendingPanRef = useRef<PanOffset | null>(null);
  const panFrameRef = useRef<number | null>(null);
  const isPinchingRef = useRef(false);

  zoomRef.current = zoom;
  if (!pendingPanRef.current) panRef.current = pan;
  panningRef.current = panning;

  useEffect(() => {
    return () => {
      if (panFrameRef.current !== null) cancelAnimationFrame(panFrameRef.current);
    };
  }, []);

  function commitPan(nextPan: PanOffset) {
    panRef.current = nextPan;
    setPan(nextPan);
  }

  function schedulePan(nextPan: PanOffset) {
    panRef.current = nextPan;
    pendingPanRef.current = nextPan;
    if (panFrameRef.current !== null) return;
    panFrameRef.current = requestAnimationFrame(() => {
      panFrameRef.current = null;
      const pending = pendingPanRef.current;
      pendingPanRef.current = null;
      if (pending) setPan(pending);
    });
  }

  function getWorkspacePoint(event: React.PointerEvent): { x: number; y: number } | null {
    const world = worldRef.current;
    if (!world) return null;
    const rect = viewportRef.current?.getBoundingClientRect() ?? world.getBoundingClientRect();
    const currentPan = panRef.current;
    const currentZoom = zoomRef.current;
    return {
      x: (event.clientX - rect.left - currentPan.x) / currentZoom,
      y: (event.clientY - rect.top - currentPan.y) / currentZoom,
    };
  }

  function zoomAtClientPoint(nextZoom: number, clientX: number, clientY: number) {
    const viewport = viewportRef.current;
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;
    if (!viewport || nextZoom === currentZoom) return;
    const rect = viewport.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const wx = (vx - currentPan.x) / currentZoom;
    const wy = (vy - currentPan.y) / currentZoom;
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    commitPan({ x: vx - wx * nextZoom, y: vy - wy * nextZoom });
  }

  function changeZoom(delta: number) {
    const viewport = viewportRef.current;
    const nextZoom = clamp(roundZoom(zoomRef.current + delta), MIN_ZOOM, MAX_ZOOM);
    if (!viewport) {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    zoomAtClientPoint(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function resetZoom() {
    zoomRef.current = 0.8;
    setZoom(0.8);
    commitPan({ x: 0, y: 0 });
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    zoomAtClientPoint(clamp(roundZoom(zoomRef.current * factor), MIN_ZOOM, MAX_ZOOM), event.clientX, event.clientY);
  }

  function handleViewportPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!shouldStartViewportPan(event.button, event.target)) return;
    if (!viewportRef.current) return;
    const nextPanning = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
    };
    panningRef.current = nextPanning;
    setPanning(nextPanning);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function applyPinch(distFactor: number, prevMidX: number, prevMidY: number, newMidX: number, newMidY: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const cz = zoomRef.current;
    const cp = panRef.current;
    const wx = (prevMidX - rect.left - cp.x) / cz;
    const wy = (prevMidY - rect.top - cp.y) / cz;
    const nextZoom = clamp(roundZoom(cz * distFactor), MIN_ZOOM, MAX_ZOOM);
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
    commitPan({
      x: (newMidX - rect.left) - wx * nextZoom,
      y: (newMidY - rect.top) - wy * nextZoom,
    });
  }

  function handlePanMove(event: React.PointerEvent): boolean {
    if (isPinchingRef.current) return true;
    const currentPanning = panningRef.current;
    if (!currentPanning) return false;
    schedulePan({
      x: currentPanning.panX + event.clientX - currentPanning.startX,
      y: currentPanning.panY + event.clientY - currentPanning.startY,
    });
    event.preventDefault();
    return true;
  }

  function handlePanEnd(): boolean {
    if (!panningRef.current) return false;
    panningRef.current = null;
    setPanning(null);
    return true;
  }

  return {
    zoom,
    pan,
    panning,
    viewportRef,
    worldRef,
    isPinchingRef,
    getWorkspacePoint,
    changeZoom,
    resetZoom,
    applyPinch,
    handleWheel,
    handleViewportPointerDown,
    handlePanMove,
    handlePanEnd,
  };
}
