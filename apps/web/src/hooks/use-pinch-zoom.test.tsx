import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePinchZoom } from "./use-pinch-zoom";

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

  it("captures two-finger camera gestures that start over child controls", () => {
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

    expect(childPointerDown).toHaveBeenCalledTimes(1);
    expect(onSetPinching).toHaveBeenCalledWith(true);
    expect(onApplyPinch).toHaveBeenCalledWith({
      distFactor: expect.any(Number),
      prevMidX: 150,
      prevMidY: 100,
      newMidX: 165,
      newMidY: 110,
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
});

function pointerEvent(type: string, pointerId: number, clientX: number, clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: "touch" },
    clientX: { value: clientX },
    clientY: { value: clientY },
  });
  return event;
}
