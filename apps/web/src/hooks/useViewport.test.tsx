import { afterEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useViewport } from "./useViewport";

type ViewportApi = ReturnType<typeof useViewport>;

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  for (const container of containers.splice(0)) {
    container.remove();
  }
});

describe("useViewport pointer ownership", () => {
  it("keeps unrelated pointers from ending an active pan", () => {
    let api: ViewportApi | null = null;
    const viewport = createViewportElement();

    renderViewport((nextApi) => {
      api = nextApi;
      api.viewportRef.current = viewport;
    });

    act(() => {
      api!.handleViewportPointerDown(pointerEvent({ pointerId: 1, currentTarget: viewport, target: viewport }));
    });

    expect(api!.panning?.pointerId).toBe(1);

    act(() => {
      expect(api!.handlePanEnd(2)).toBe(false);
    });

    expect(api!.panning?.pointerId).toBe(1);

    act(() => {
      expect(api!.handlePanEnd(1)).toBe(true);
    });

    expect(api!.panning).toBeNull();
  });

  it("cancels an active pan when a pinch starts", () => {
    let api: ViewportApi | null = null;
    const viewport = createViewportElement();

    renderViewport((nextApi) => {
      api = nextApi;
      api.viewportRef.current = viewport;
    });

    act(() => {
      api!.handleViewportPointerDown(pointerEvent({ pointerId: 1, currentTarget: viewport, target: viewport }));
    });

    expect(api!.panning?.pointerId).toBe(1);

    act(() => {
      api!.cancelPan();
    });

    expect(api!.panning).toBeNull();
  });
});

function renderViewport(onRender: (api: ViewportApi) => void): void {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(<ViewportHarness onRender={onRender} />);
  });
}

function ViewportHarness({ onRender }: { onRender: (api: ViewportApi) => void }) {
  const api = useViewport();

  useEffect(() => {
    onRender(api);
  });

  return null;
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
}): React.PointerEvent<HTMLDivElement> {
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
  } as unknown as React.PointerEvent<HTMLDivElement>;
}
