import { cleanup, renderHook } from "@solidjs/testing-library";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRemoteCursors } from "./use-remote-cursors";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-22T00:00:00.000Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useRemoteCursors", () => {
  it("publishes local presence with throttling unless forced", () => {
    const broadcasts: ChannelMessage[] = [];
    const { result } = renderHook(() =>
      useRemoteCursors({
        myId: () => "local",
        name: () => "Ada",
        broadcast: (message) => broadcasts.push(message),
      }),
    );

    result.publishCursor({ x: 1, y: 2 });
    result.publishCursor({ x: 3, y: 4 });
    result.publishCursor(null, true);

    expect(broadcasts).toEqual([
      { type: "presence", participantId: "local", name: "Ada", cursor: { x: 1, y: 2 } },
      { type: "presence", participantId: "local", name: "Ada", cursor: null },
    ]);
  });

  it("upserts remote cursors and removes them when peers clear presence", () => {
    const { result } = renderHook(() =>
      useRemoteCursors({ myId: () => "local", name: () => "Ada", broadcast: () => {} }),
    );

    result.handleMessage("peer-1", { type: "presence", participantId: "peer-1", name: "Grace", cursor: { x: 1, y: 2 } });
    result.handleMessage("peer-1", { type: "presence", participantId: "peer-1", name: "Grace Hopper", cursor: { x: 3, y: 4 } });

    expect(result.remoteCursors()).toEqual([
      { participantId: "peer-1", name: "Grace Hopper", x: 3, y: 4, seenAt: Date.now() },
    ]);

    result.handleMessage("peer-1", { type: "presence", participantId: "peer-1", name: "Grace Hopper", cursor: null });

    expect(result.remoteCursors()).toEqual([]);
  });

  it("tracks active remote cursors with a short TTL and ignores local activity", () => {
    const { result } = renderHook(() =>
      useRemoteCursors({ myId: () => "local", name: () => "Ada", broadcast: () => {} }),
    );

    result.markActive("local");
    result.markActive("peer-1");

    expect([...result.activeRemoteCursorIds()]).toEqual(["peer-1"]);

    vi.advanceTimersByTime(120);

    expect([...result.activeRemoteCursorIds()]).toEqual([]);
  });

  it("removes one cursor or clears all cursor state", () => {
    const { result } = renderHook(() =>
      useRemoteCursors({ myId: () => "local", name: () => "Ada", broadcast: () => {} }),
    );

    result.handleMessage("peer-1", { type: "presence", participantId: "peer-1", name: "Grace", cursor: { x: 1, y: 2 } });
    result.handleMessage("peer-2", { type: "presence", participantId: "peer-2", name: "Linus", cursor: { x: 3, y: 4 } });
    result.updateCursorName("peer-2", "Linus T.");
    result.markActive("peer-2");
    result.removeCursor("peer-1");

    expect(result.remoteCursors()).toEqual([
      { participantId: "peer-2", name: "Linus T.", x: 3, y: 4, seenAt: Date.now() },
    ]);

    result.clearAll();

    expect(result.remoteCursors()).toEqual([]);
    expect([...result.activeRemoteCursorIds()]).toEqual([]);
  });
});
