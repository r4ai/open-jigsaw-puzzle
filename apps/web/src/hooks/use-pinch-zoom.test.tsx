import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePinchZoom } from "./use-pinch-zoom";

afterEach(() => cleanup());

describe("usePinchZoom", () => {
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
