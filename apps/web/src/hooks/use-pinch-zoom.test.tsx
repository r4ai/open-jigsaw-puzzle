import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePinchZoom } from "./use-pinch-zoom";
import { useViewport } from "./use-viewport";

afterEach(() => cleanup());

describe("usePinchZoom", () => {
  it("does not report pinch end after a single-touch gesture", () => {
    const onSetPinching = vi.fn();
    let viewport: HTMLDivElement | undefined;

    render(() => {
      usePinchZoom({
        getElement: () => viewport,
        onApplyPinch: () => {},
        onSetPinching,
      });

      return <div ref={(el) => (viewport = el)} />;
    });

    viewport!.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    viewport!.dispatchEvent(pointerEvent("pointermove", 1, 120, 120));
    viewport!.dispatchEvent(pointerEvent("pointerup", 1, 120, 120));

    expect(onSetPinching).not.toHaveBeenCalled();
  });

  it("captures two-finger camera gestures that start over child controls", async () => {
    const onApplyPinch = vi.fn();
    const onSetPinching = vi.fn();
    const childPointerDown = vi.fn();
    let viewport: HTMLDivElement | undefined;
    let child: HTMLButtonElement | undefined;

    render(() => {
      usePinchZoom({
        getElement: () => viewport,
        onApplyPinch,
        onSetPinching,
      });

      return (
        <div ref={(el) => (viewport = el)}>
          <button ref={(el) => (child = el)} onPointerDown={childPointerDown}>
            piece
          </button>
        </div>
      );
    });

    child!.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    child!.dispatchEvent(pointerEvent("pointerdown", 2, 200, 100));
    child!.dispatchEvent(pointerEvent("pointermove", 2, 230, 120));
    child!.dispatchEvent(pointerEvent("pointermove", 2, 240, 130));
    await flushAnimationFrame();

    expect(childPointerDown).toHaveBeenCalledTimes(1);
    expect(onSetPinching).toHaveBeenCalledWith(true);
    expect(onApplyPinch).toHaveBeenCalledTimes(1);
    expect(onApplyPinch).toHaveBeenCalledWith({
      distFactor: expect.any(Number),
      prevMidX: 150,
      prevMidY: 100,
      newMidX: 170,
      newMidY: 115,
    });
  });

  it("reports pinch end only after an actual two-finger gesture", () => {
    const onSetPinching = vi.fn();
    let viewport: HTMLDivElement | undefined;

    render(() => {
      usePinchZoom({
        getElement: () => viewport,
        onApplyPinch: () => {},
        onSetPinching,
      });

      return <div ref={(el) => (viewport = el)} />;
    });

    viewport!.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    viewport!.dispatchEvent(pointerEvent("pointerdown", 2, 200, 100));
    viewport!.dispatchEvent(pointerEvent("pointerup", 2, 200, 100));

    expect(onSetPinching).toHaveBeenCalledTimes(2);
    expect(onSetPinching).toHaveBeenNthCalledWith(1, true);
    expect(onSetPinching).toHaveBeenNthCalledWith(2, false);
  });

  it("keeps the next one-finger viewport pan available after a one-finger touch", () => {
    let viewport: HTMLDivElement | undefined;
    let api!: ReturnType<typeof useViewport>;

    render(() => {
      api = useViewport();
      usePinchZoom({
        getElement: () => viewport,
        onApplyPinch: (event) =>
          api.applyPinch(
            event.distFactor,
            event.prevMidX,
            event.prevMidY,
            event.newMidX,
            event.newMidY,
          ),
        onSetPinching: api.setTouchGestureActive,
      });

      return (
        <div
          ref={(el) => {
            viewport = el;
            prepareViewportElement(el);
            api.setViewportEl(el);
          }}
          onPointerDown={(event) => api.handleViewportPointerDown(event)}
        />
      );
    });

    viewport!.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    viewport!.dispatchEvent(pointerEvent("pointermove", 1, 120, 120));
    viewport!.dispatchEvent(pointerEvent("pointerup", 1, 120, 120));
    viewport!.dispatchEvent(pointerEvent("pointerdown", 2, 140, 140));

    expect(api!.panning()?.pointerId).toBe(2);
  });

  it("allows the next one-finger viewport pan after a two-finger camera gesture", () => {
    let viewport: HTMLDivElement | undefined;
    let api!: ReturnType<typeof useViewport>;

    render(() => {
      api = useViewport();
      usePinchZoom({
        getElement: () => viewport,
        onApplyPinch: (event) =>
          api.applyPinch(
            event.distFactor,
            event.prevMidX,
            event.prevMidY,
            event.newMidX,
            event.newMidY,
          ),
        onSetPinching: api.setTouchGestureActive,
      });

      return (
        <div
          ref={(el) => {
            viewport = el;
            prepareViewportElement(el);
            api.setViewportEl(el);
          }}
          onPointerDown={(event) => api.handleViewportPointerDown(event)}
        />
      );
    });

    viewport!.dispatchEvent(pointerEvent("pointerdown", 1, 100, 100));
    viewport!.dispatchEvent(pointerEvent("pointerdown", 2, 200, 100));
    viewport!.dispatchEvent(pointerEvent("pointerup", 2, 200, 100));
    viewport!.dispatchEvent(pointerEvent("pointerup", 1, 120, 100));
    viewport!.dispatchEvent(pointerEvent("pointerdown", 3, 140, 140));

    expect(api!.panning()?.pointerId).toBe(3);
  });
});

function pointerEvent(type: string, pointerId: number, clientX: number, clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    pointerId: { value: pointerId },
    pointerType: { value: "touch" },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}

async function flushAnimationFrame(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function prepareViewportElement(element: HTMLDivElement) {
  element.setPointerCapture = vi.fn();
  element.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    top: 0,
    right: 800,
    bottom: 600,
    left: 0,
    toJSON: () => ({}),
  });
}
