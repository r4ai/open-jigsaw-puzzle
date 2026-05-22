import { onCleanup, onMount } from "solid-js";

type PinchEvent = {
  distFactor: number;
  prevMidX: number;
  prevMidY: number;
  newMidX: number;
  newMidY: number;
};

type Props = {
  getElement: () => HTMLElement | undefined;
  onApplyPinch: (e: PinchEvent) => void;
  onSetPinching: (pinching: boolean) => void;
};

/**
 * Tracks two-finger pinch gestures on the given element and reports zoom
 * factor and midpoint deltas back to the caller.
 */
export function usePinchZoom(props: Props) {
  onMount(() => {
    const el = props.getElement();
    if (!el) return;

    const touches = new Map<number, { x: number; y: number }>();
    let prevMidX = 0;
    let prevMidY = 0;
    let prevDist = 1;

    function midAndDist() {
      const [a, b] = [...touches.values()];
      return {
        midX: (a!.x + b!.x) / 2,
        midY: (a!.y + b!.y) / 2,
        dist: Math.hypot(b!.x - a!.x, b!.y - a!.y),
      };
    }

    function onDown(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const { midX, midY, dist } = midAndDist();
        prevMidX = midX;
        prevMidY = midY;
        prevDist = dist;
        e.preventDefault();
        props.onSetPinching(true);
      }
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size < 2) return;
      const { midX, midY, dist } = midAndDist();
      e.preventDefault();
      if (prevDist <= 0 || dist <= 0) {
        prevMidX = midX;
        prevMidY = midY;
        prevDist = dist;
        return;
      }
      props.onApplyPinch({
        distFactor: dist / prevDist,
        prevMidX,
        prevMidY,
        newMidX: midX,
        newMidY: midY,
      });
      prevMidX = midX;
      prevMidY = midY;
      prevDist = dist;
    }

    function onUp(e: PointerEvent) {
      if (e.pointerType !== "touch") return;
      touches.delete(e.pointerId);
      if (touches.size < 2) props.onSetPinching(false);
    }

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    onCleanup(() => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    });
  });
}
