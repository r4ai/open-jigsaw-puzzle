import { cleanup, renderHook } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { useImageOverlay } from "./useImageOverlay";

afterEach(() => {
  cleanup();
});

describe("useImageOverlay", () => {
  it("initializes next to the board only once", () => {
    const broadcasts: ChannelMessage[] = [];
    const { result } = renderHook(() => useImageOverlay({ broadcast: (message) => broadcasts.push(message) }));

    result.initPosition(layout);
    result.initPosition({ ...layout, boardWidth: 400 });

    expect(result.position()).toEqual({ x: 220, y: 0 });
    expect(broadcasts).toEqual([]);
  });

  it("broadcasts lock and opacity changes with the current position", () => {
    const broadcasts: ChannelMessage[] = [];
    const { result } = renderHook(() => useImageOverlay({ broadcast: (message) => broadcasts.push(message) }));

    result.initPosition(layout);
    result.toggleLock();
    result.changeOpacity(1.5);

    expect(result.locked()).toBe(true);
    expect(result.opacity()).toBe(1);
    expect(broadcasts).toEqual([
      { type: "image-overlay", x: 220, y: 0, locked: true, opacity: 1 },
      { type: "image-overlay", x: 220, y: 0, locked: true, opacity: 1 },
    ]);
  });

  it("moves the overlay by pointer drag and ignores unrelated pointers", () => {
    const broadcasts: ChannelMessage[] = [];
    const target = { setPointerCapture: vi.fn() };
    const { result } = renderHook(() => useImageOverlay({ broadcast: (message) => broadcasts.push(message) }));

    result.initPosition(layout);
    result.handlePointerDown(pointerEvent(7, 10, 15, target), point);
    result.handleDragMove(pointerEvent(8, 100, 100, target), point);
    result.handleDragMove(pointerEvent(7, 15, 25, target), point);
    result.handleDragEnd(8);

    expect(result.isDragging()).toBe(true);
    expect(result.position()).toEqual({ x: 225, y: 10 });
    expect(broadcasts).toEqual([{ type: "image-overlay", x: 225, y: 10, locked: false, opacity: 1 }]);

    result.handleDragEnd(7);
    expect(result.isDragging()).toBe(false);
  });

  it("applies remote overlay state", () => {
    const { result } = renderHook(() => useImageOverlay({ broadcast: () => {} }));

    result.handleMessage("host", { type: "image-overlay", x: 12, y: 34, locked: true, opacity: 0.4 });

    expect(result.position()).toEqual({ x: 12, y: 34 });
    expect(result.locked()).toBe(true);
    expect(result.opacity()).toBe(0.4);
  });
});

const layout: PuzzleLayout = {
  difficulty: 48,
  rows: 1,
  cols: 1,
  boardWidth: 200,
  boardHeight: 100,
  pieceWidth: 200,
  pieceHeight: 100,
  tabSize: 20,
  pieces: [],
};

function point(event: PointerEvent) {
  return { x: event.clientX, y: event.clientY };
}

function pointerEvent(pointerId: number, clientX: number, clientY: number, currentTarget: unknown): PointerEvent {
  return {
    pointerId,
    clientX,
    clientY,
    currentTarget,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent;
}
