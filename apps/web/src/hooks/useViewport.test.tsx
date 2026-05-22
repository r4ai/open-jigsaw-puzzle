import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@solidjs/testing-library";
import { useViewport } from "./useViewport";

type ViewportApi = ReturnType<typeof useViewport>;

describe("useViewport pointer ownership", () => {
  it("keeps unrelated pointers from ending an active pan", () => {
    const { api, viewport } = setupViewport();

    startPan(api, viewport, 1);

    expect(api.panning()?.pointerId).toBe(1);
    expect(api.handlePanEnd(2)).toBe(false);
    expect(api.panning()?.pointerId).toBe(1);
    expect(api.handlePanEnd(1)).toBe(true);
    expect(api.panning()).toBeNull();
  });

  it("cancels an active pan when a pinch starts", () => {
    const { api, viewport } = setupViewport();

    startPan(api, viewport, 1);
    expect(api.panning()?.pointerId).toBe(1);

    api.cancelPan();

    expect(api.panning()).toBeNull();
  });
});

function setupViewport(): { api: ViewportApi; viewport: HTMLDivElement } {
  const { result: api } = renderHook(useViewport);
  const viewport = createViewportElement();
  api.setViewportEl(viewport);

  return { api, viewport };
}

function startPan(api: ViewportApi, viewport: HTMLDivElement, pointerId: number): void {
  api.handleViewportPointerDown(pointerEvent({ pointerId, currentTarget: viewport, target: viewport }));
}

function createViewportElement(): HTMLDivElement {
  const viewport = document.createElement("div");
  viewport.setPointerCapture = vi.fn();
  viewport.getBoundingClientRect = () => ({
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
  return viewport;
}

function pointerEvent({
  pointerId,
  currentTarget,
  target,
  button = 0,
}: {
  pointerId: number;
  currentTarget: HTMLDivElement;
  target: EventTarget;
  button?: number;
}): PointerEvent {
  return {
    button,
    buttons: button === 0 ? 1 : 4,
    pointerId,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    currentTarget,
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent;
}
