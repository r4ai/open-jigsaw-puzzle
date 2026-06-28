import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@solidjs/testing-library";
import { createPuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { usePieceStore } from "./use-piece-store";

function setup(broadcast: (msg: ChannelMessage) => void = () => {}) {
  const { result } = renderHook(() =>
    usePieceStore({
      broadcast,
      myId: () => "local",
      getStartedAtMs: () => null,
      resetTimer: () => {},
      clearMoveHistory: () => {},
    }),
  );
  return result;
}

describe("usePieceStore", () => {
  it("keeps the synchronous mirror in lockstep with the signal", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const store = setup();

    expect(store.getPieces()).toEqual(store.pieces());

    store.setNewPieces(layout);
    expect(store.getPieces()).toBe(store.pieces());
    expect(store.getPieces()).toHaveLength(layout.pieces.length);

    store.updatePieces((current) => current.map((p) => (p.id === 0 ? { ...p, x: 99 } : p)));
    expect(store.getPieces()).toBe(store.pieces());
    expect(store.getPieces()[0]?.x).toBe(99);
  });

  it("buffers a sync received before pieces exist and applies it on the next image", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const store = setup();

    store.applySyncedPieces([{ id: 0, x: 12, y: 34, z: 5, locked: true }]);
    expect(store.pieces()).toHaveLength(0);

    store.receiveImage(layout);
    expect(store.pieces()[0]).toMatchObject({ x: 12, y: 34, z: 5, locked: true });
  });

  it("broadcasts a state-sync when organizing loose pieces", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const broadcast = vi.fn();
    const store = setup(broadcast);

    store.setNewPieces(layout);
    broadcast.mockClear();
    store.organizePieces(layout);

    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "state-sync" }));
  });
});
