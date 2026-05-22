import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@solidjs/testing-library";
import { useViewport } from "./use-viewport";

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

describe("useViewport coordinates and zoom", () => {
  it("converts client coordinates into workspace coordinates after pan and zoom", () => {
    const { api, viewport } = setupViewport();
    const world = document.createElement("div");
    api.setWorldEl(world);

    api.changeZoom(0.2);
    api.handleViewportPointerDown(pointerEvent({ pointerId: 1, currentTarget: viewport, target: viewport }));
    api.handlePanMove(pointerEvent({ pointerId: 1, currentTarget: viewport, target: viewport, clientX: 150, clientY: 80 }));

    expect(api.getWorkspacePoint(pointerEvent({ pointerId: 2, currentTarget: viewport, target: viewport, clientX: 260, clientY: 150 }))).toEqual({
      x: 310,
      y: 245,
    });
  });

  it("zooms wheel events around the pointer and reset returns to the default view", () => {
    const { api, viewport } = setupViewport();

    api.handleWheel(wheelEvent({ currentTarget: viewport, clientX: 400, clientY: 300, deltaY: -1 }));

    expect(api.zoom()).toBe(0.9);
    expect(api.pan()).toEqual({ x: -50, y: -37.5 });

    api.resetZoom();

    expect(api.zoom()).toBe(0.8);
    expect(api.pan()).toEqual({ x: 0, y: 0 });
  });

  it("applies pinch zoom around the previous midpoint and moves toward the new midpoint", () => {
    const { api } = setupViewport();

    api.applyPinch(2, 100, 100, 120, 130);

    expect(api.zoom()).toBe(1.6);
    expect(api.pan()).toEqual({ x: -80, y: -70 });
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
  clientX = 100,
  clientY = 100,
}: {
  pointerId: number;
  currentTarget: HTMLDivElement;
  target: EventTarget;
  button?: number;
  clientX?: number;
  clientY?: number;
}): PointerEvent {
  return {
    button,
    buttons: button === 0 ? 1 : 4,
    pointerId,
    pointerType: "touch",
    clientX,
    clientY,
    currentTarget,
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent;
}

function wheelEvent({
  currentTarget,
  clientX,
  clientY,
  deltaY,
}: {
  currentTarget: HTMLDivElement;
  clientX: number;
  clientY: number;
  deltaY: number;
}): WheelEvent {
  return {
    currentTarget,
    clientX,
    clientY,
    deltaY,
    preventDefault: vi.fn(),
  } as unknown as WheelEvent;
}
