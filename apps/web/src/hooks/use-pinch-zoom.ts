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
    let pinching = false;
    let pinchFrame: number | null = null;

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
        e.stopPropagation();
        pinching = true;
        props.onSetPinching(true);
      } else if (touches.size > 2) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      const coalesced = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      const latest = coalesced.at(-1) ?? e;
      touches.set(e.pointerId, { x: latest.clientX, y: latest.clientY });
      if (touches.size < 2) return;
      e.preventDefault();
      e.stopPropagation();
      schedulePinch();
    }

    function schedulePinch() {
      if (pinchFrame !== null) return;
      pinchFrame = requestAnimationFrame(() => {
        pinchFrame = null;
        flushPinch();
      });
    }

    function flushPinch() {
      if (touches.size < 2) return;
      const { midX, midY, dist } = midAndDist();
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
      if (touches.size < 2 && pinching) {
        if (pinchFrame !== null) {
          cancelAnimationFrame(pinchFrame);
          pinchFrame = null;
        }
        pinching = false;
        props.onSetPinching(false);
      } else if (touches.size === 2 && pinching) {
        if (pinchFrame !== null) {
          cancelAnimationFrame(pinchFrame);
          pinchFrame = null;
        }
        const { midX, midY, dist } = midAndDist();
        prevMidX = midX;
        prevMidY = midY;
        prevDist = dist;
      }
    }

    el.addEventListener("pointerdown", onDown, { capture: true });
    el.addEventListener("pointermove", onMove, { capture: true });
    el.addEventListener("pointerup", onUp, { capture: true });
    el.addEventListener("pointercancel", onUp, { capture: true });
    onCleanup(() => {
      if (pinchFrame !== null) cancelAnimationFrame(pinchFrame);
      el.removeEventListener("pointerdown", onDown, { capture: true });
      el.removeEventListener("pointermove", onMove, { capture: true });
      el.removeEventListener("pointerup", onUp, { capture: true });
      el.removeEventListener("pointercancel", onUp, { capture: true });
    });
  });
}
