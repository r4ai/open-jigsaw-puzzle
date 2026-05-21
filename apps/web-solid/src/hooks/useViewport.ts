import { createSignal, onCleanup } from "solid-js";
import { clamp, roundZoom, shouldStartViewportPan } from "../utils/puzzle-ops";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.15;
const WHEEL_ZOOM_FACTOR = 1.12;

export type PanOffset = { x: number; y: number };
type PanState = { pointerId: number; startX: number; startY: number; panX: number; panY: number };

// Solid 版: useRef を排し、可変参照は通常の let を使用。
// State (signal) と "現在値の参照" (let) を二重化して、ドラッグ計算が
// バッチング遅延を受けないようにする。
export function useViewport() {
  const [zoom, setZoom] = createSignal(0.8);
  const [pan, setPan] = createSignal<PanOffset>({ x: 0, y: 0 });
  const [panning, setPanning] = createSignal<PanState | null>(null);

  let viewportEl: HTMLDivElement | undefined;
  let worldEl: HTMLDivElement | undefined;
  let zoomNow = 0.8;
  let panNow: PanOffset = { x: 0, y: 0 };
  let pendingPan: PanOffset | null = null;
  let panFrame: number | null = null;
  let isPinching = false;
  let panningNow: PanState | null = null;

  onCleanup(() => {
    if (panFrame !== null) cancelAnimationFrame(panFrame);
  });

  function commitZoom(next: number) {
    zoomNow = next;
    setZoom(next);
  }

  function commitPan(nextPan: PanOffset) {
    panNow = nextPan;
    setPan(nextPan);
  }

  function schedulePan(nextPan: PanOffset) {
    panNow = nextPan;
    pendingPan = nextPan;
    if (panFrame !== null) return;
    panFrame = requestAnimationFrame(() => {
      panFrame = null;
      const pending = pendingPan;
      pendingPan = null;
      if (pending) setPan(pending);
    });
  }

  function getWorkspacePoint(event: PointerEvent): { x: number; y: number } | null {
    const world = worldEl;
    if (!world) return null;
    const rect = viewportEl?.getBoundingClientRect() ?? world.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - panNow.x) / zoomNow,
      y: (event.clientY - rect.top - panNow.y) / zoomNow,
    };
  }

  function zoomAtClientPoint(nextZoom: number, clientX: number, clientY: number) {
    if (!viewportEl || nextZoom === zoomNow) return;
    const rect = viewportEl.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const wx = (vx - panNow.x) / zoomNow;
    const wy = (vy - panNow.y) / zoomNow;
    commitZoom(nextZoom);
    commitPan({ x: vx - wx * nextZoom, y: vy - wy * nextZoom });
  }

  function changeZoom(delta: number) {
    const nextZoom = clamp(roundZoom(zoomNow + delta), MIN_ZOOM, MAX_ZOOM);
    if (!viewportEl) {
      commitZoom(nextZoom);
      return;
    }
    const rect = viewportEl.getBoundingClientRect();
    zoomAtClientPoint(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function resetZoom() {
    commitZoom(0.8);
    commitPan({ x: 0, y: 0 });
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    zoomAtClientPoint(
      clamp(roundZoom(zoomNow * factor), MIN_ZOOM, MAX_ZOOM),
      event.clientX,
      event.clientY,
    );
  }

  function handleViewportPointerDown(event: PointerEvent) {
    if (isPinching) return;
    if (!shouldStartViewportPan(event.button, event.target)) return;
    if (!viewportEl) return;
    const nextPanning: PanState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: panNow.x,
      panY: panNow.y,
    };
    panningNow = nextPanning;
    setPanning(nextPanning);
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function applyPinch(distFactor: number, prevMidX: number, prevMidY: number, newMidX: number, newMidY: number) {
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    const cz = zoomNow;
    const cp = panNow;
    const wx = (prevMidX - rect.left - cp.x) / cz;
    const wy = (prevMidY - rect.top - cp.y) / cz;
    const nextZoom = clamp(roundZoom(cz * distFactor), MIN_ZOOM, MAX_ZOOM);
    commitZoom(nextZoom);
    commitPan({
      x: (newMidX - rect.left) - wx * nextZoom,
      y: (newMidY - rect.top) - wy * nextZoom,
    });
  }

  function handlePanMove(event: PointerEvent): boolean {
    if (isPinching) return true;
    if (!panningNow) return false;
    if (event.pointerId !== panningNow.pointerId) return false;
    schedulePan({
      x: panningNow.panX + event.clientX - panningNow.startX,
      y: panningNow.panY + event.clientY - panningNow.startY,
    });
    event.preventDefault();
    return true;
  }

  function handlePanEnd(pointerId?: number): boolean {
    if (!panningNow) return false;
    if (pointerId !== undefined && pointerId !== panningNow.pointerId) return false;
    panningNow = null;
    setPanning(null);
    return true;
  }

  function cancelPan() {
    if (!panningNow) return;
    panningNow = null;
    setPanning(null);
  }

  return {
    zoom,
    pan,
    panning,
    setViewportEl: (el: HTMLDivElement | undefined) => { viewportEl = el; },
    setWorldEl: (el: HTMLDivElement | undefined) => { worldEl = el; },
    getViewportEl: () => viewportEl,
    getIsPinching: () => isPinching,
    setIsPinching: (v: boolean) => { isPinching = v; },
    getWorkspacePoint,
    changeZoom,
    resetZoom,
    applyPinch,
    handleWheel,
    handleViewportPointerDown,
    handlePanMove,
    handlePanEnd,
    cancelPan,
  };
}
