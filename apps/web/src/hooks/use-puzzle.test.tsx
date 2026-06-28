import { describe, expect, it } from "vitest";
import { renderHook } from "@solidjs/testing-library";
import { createPuzzleLayout, type PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { usePuzzle } from "./use-puzzle";

type PuzzleApi = ReturnType<typeof usePuzzle>;

describe("usePuzzle image lifecycle", () => {
  it("recreates pieces from the new layout when an image is replaced", () => {
    const firstLayout = createPuzzleLayout(48, 1200, 800);
    const nextLayout = createPuzzleLayout(48, 800, 1200);
    const { api } = setupPuzzle();

    api.setNewPieces(firstLayout);
    expect(api.pieces()[1]?.targetX).toBe(firstLayout.pieces[1]?.targetX);

    api.receiveImage(nextLayout);

    expect(api.pieces()).toHaveLength(nextLayout.pieces.length);
    expect(api.pieces()[1]?.targetX).toBe(nextLayout.pieces[1]?.targetX);
    expect(api.pieces()[1]?.targetX).not.toBe(firstLayout.pieces[1]?.targetX);
  });
});

describe("usePuzzle peer messages", () => {
  it("applies batched piece moves in one update", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const { api } = setupPuzzle();

    api.setNewPieces(layout);
    api.handleMessage("peer-1", {
      type: "piece-moves",
      by: "peer-1",
      moves: [
        { pieceId: 0, x: 11, y: 22, z: 33 },
        { pieceId: 1, x: 44, y: 55, z: 66 },
      ],
    });

    expect(api.pieces()[0]).toMatchObject({ x: 11, y: 22, z: 33 });
    expect(api.pieces()[1]).toMatchObject({ x: 44, y: 55, z: 66 });
  });

  it("applies batched piece-locks remotely", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const { api } = setupPuzzle({ layout });

    api.setNewPieces(layout);
    api.handleMessage("peer-1", {
      type: "piece-locks",
      by: "peer-1",
      locks: [
        { pieceId: 0, x: 7, y: 8, z: 9 },
        { pieceId: 2, x: 10, y: 11, z: 12 },
      ],
    });

    expect(api.pieces()[0]).toMatchObject({ x: 7, y: 8, z: 9, locked: true });
    expect(api.pieces()[2]).toMatchObject({ x: 10, y: 11, z: 12, locked: true });
    expect(api.pieces()[1]?.locked).toBe(false);
  });
});

describe("usePuzzle local drag", () => {
  it("updates DOM transform without mutating pieces state during drag", async () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const broadcasts: ChannelMessage[] = [];
    const { api } = setupPuzzle({ layout, broadcast: (message) => broadcasts.push(message) });

    api.setNewPieces(layout);
    const { piece, pieceEl } = registerPieceElement(api, 0);
    const start = { x: piece.x, y: piece.y };

    dragPiece(api, piece, {
      pointerId: 7,
      startPoint: { x: 0, y: 0 },
      nextPoint: { x: 30, y: 40 },
      margin: 50,
    });
    await flushAnimationFrames();

    expect(api.pieces()[0]).toMatchObject(start);
    expect(pieceEl.style.transform).toBe(`translate3d(${50 + start.x + 30}px, ${50 + start.y + 40}px, 0)`);
    expect(broadcasts.some((message) => message.type === "piece-move" || message.type === "piece-moves")).toBe(true);

    api.handleDragEnd(1, 7);

    expect(api.pieces()[0]?.x).toBeCloseTo(start.x + 30);
    expect(api.pieces()[0]?.y).toBeCloseTo(start.y + 40);
  });

  it("does not broadcast a touch tap with only tiny movement", async () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const broadcasts: ChannelMessage[] = [];
    const { api } = setupPuzzle({ layout, broadcast: (message) => broadcasts.push(message) });

    api.setNewPieces(layout);
    const { piece } = registerPieceElement(api, 0);

    dragPiece(api, piece, {
      pointerId: 7,
      pointerType: "touch",
      startPoint: { x: 0, y: 0 },
      nextPoint: { x: 2, y: 3 },
      margin: 50,
    });
    await flushAnimationFrames();

    expect(broadcasts.some((message) => message.type === "piece-move" || message.type === "piece-moves")).toBe(false);
    api.handleDragEnd(1, 7);
    expect(api.pieces()[0]).toMatchObject({ x: piece.x, y: piece.y });
  });

  it("cancels an active drag without committing or snapping the piece", async () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const broadcasts: ChannelMessage[] = [];
    const { api } = setupPuzzle({ layout, broadcast: (message) => broadcasts.push(message) });

    api.setNewPieces(layout);
    const { piece, pieceEl } = registerPieceElement(api, 0);
    const start = { x: piece.x, y: piece.y };

    dragPiece(api, piece, {
      pointerId: 7,
      pointerType: "touch",
      startPoint: { x: 0, y: 0 },
      nextPoint: { x: 30, y: 40 },
      margin: 50,
    });
    await flushAnimationFrames();

    api.cancelDrag();

    expect(api.pieces()[0]).toMatchObject(start);
    expect(pieceEl.style.transform).toBe(`translate3d(${50 + start.x}px, ${50 + start.y}px, 0)`);
    expect(broadcasts.at(-1)).toMatchObject({
      type: "piece-move",
      pieceId: 0,
      x: start.x,
      y: start.y,
    });
  });

  it("clears piece and image selections when a touch gesture takes over", async () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const broadcasts: ChannelMessage[] = [];
    const { api } = setupPuzzle({ layout, broadcast: (message) => broadcasts.push(message) });

    api.setNewPieces(layout);
    const { piece } = registerPieceElement(api, 0);
    api.handlePointerDown(
      makePointerEvent({ pointerId: 7, pointerType: "touch", clientX: 10, clientY: 15 }),
      piece,
      () => ({ x: piece.x, y: piece.y }),
      50,
    );

    expect(api.selectedPieceIds().has(0)).toBe(true);

    api.cancelDrag();
    api.clearSelection();

    expect(api.selectedPieceIds()).toEqual(new Set());
    expect(api.imageOverlaySelected()).toBe(false);
    await flushAnimationFrames();
    expect([...broadcasts].reverse().find((message) => message.type === "selection-presence")).toEqual({
      type: "selection-presence",
      participantId: "local",
      pieceIds: [],
      imageOverlaySelected: false,
    });
  });
});

describe("usePuzzle state sync", () => {
  it("records the host start time and merges synced pieces", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const { api } = setupPuzzle({ layout, isHost: false });

    api.setNewPieces(layout);
    expect(api.getStartedAtMs()).toBeNull();

    api.handleMessage("peer-1", {
      type: "state-sync",
      by: "peer-1",
      startedAtMs: 12_345,
      lockedCount: 1,
      pieces: [{ id: 0, x: 5, y: 6, z: 7, locked: true }],
    });

    expect(api.getStartedAtMs()).toBe(12_345);
    expect(api.pieces()[0]).toMatchObject({ x: 5, y: 6, z: 7, locked: true });
    expect(api.pieces()[1]?.locked).toBe(false);
  });

  it("buffers a sync received before pieces exist and applies it on the next image", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const { api } = setupPuzzle({ layout, isHost: false });

    api.handleMessage("peer-1", {
      type: "state-sync",
      by: "peer-1",
      startedAtMs: 999,
      lockedCount: 0,
      pieces: [{ id: 0, x: 21, y: 22, z: 23, locked: false }],
    });
    expect(api.pieces()).toHaveLength(0);

    api.receiveImage(layout);

    expect(api.pieces()).toHaveLength(layout.pieces.length);
    expect(api.pieces()[0]).toMatchObject({ x: 21, y: 22, z: 23 });
  });
});

describe("usePuzzle remote presence", () => {
  it("brings a piece to front via piece-front without touching other fields", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const { api } = setupPuzzle({ layout });

    api.setNewPieces(layout);
    const before = api.pieces()[2]!;
    api.handleMessage("peer-1", { type: "piece-front", by: "peer-1", pieceId: 2, z: 999 });

    expect(api.pieces()[2]).toMatchObject({ x: before.x, y: before.y, z: 999, locked: before.locked });
  });

  it("upserts and removes a remote selection", () => {
    const { api } = setupPuzzle();

    api.handleMessage("peer-2", {
      type: "selection-presence",
      participantId: "peer-2",
      pieceIds: [1, 3],
      imageOverlaySelected: true,
    });
    expect(api.remoteSelections()).toEqual([
      { participantId: "peer-2", pieceIds: [1, 3], imageOverlaySelected: true },
    ]);

    api.handleMessage("peer-2", {
      type: "selection-presence",
      participantId: "peer-2",
      pieceIds: [4],
      imageOverlaySelected: false,
    });
    expect(api.remoteSelections()).toEqual([
      { participantId: "peer-2", pieceIds: [4], imageOverlaySelected: false },
    ]);

    api.removeRemoteSelection("peer-2");
    expect(api.remoteSelections()).toEqual([]);
  });

  it("keeps the first completion time and ignores later ones", () => {
    const { api } = setupPuzzle({ isHost: false });

    api.handleMessage("peer-1", { type: "puzzle-completed", by: "peer-1", elapsedMs: 9_999 });
    expect(api.clearedElapsedMs()).toBe(9_999);

    api.handleMessage("peer-1", { type: "puzzle-completed", by: "peer-1", elapsedMs: 5_555 });
    expect(api.clearedElapsedMs()).toBe(9_999);
  });
});

describe("usePuzzle history", () => {
  it("undoes a committed drag and restores the original position", async () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const { api } = setupPuzzle({ layout });

    api.setNewPieces(layout);
    const { piece } = registerPieceElement(api, 0);
    const start = { x: piece.x, y: piece.y };

    dragPiece(api, piece, { pointerId: 7, startPoint: { x: 0, y: 0 }, nextPoint: { x: 30, y: 40 }, margin: 50 });
    await flushAnimationFrames();
    api.handleDragEnd(1, 7);
    expect(api.pieces()[0]?.x).toBeCloseTo(start.x + 30);

    expect(api.undoLastMove()).toBe("applied");
    expect(api.pieces()[0]).toMatchObject(start);
  });

  it("blocks undo once a remote move advances the version", async () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const { api } = setupPuzzle({ layout });

    api.setNewPieces(layout);
    const { piece } = registerPieceElement(api, 0);

    dragPiece(api, piece, { pointerId: 7, startPoint: { x: 0, y: 0 }, nextPoint: { x: 30, y: 40 }, margin: 50 });
    await flushAnimationFrames();
    api.handleDragEnd(1, 7);

    api.handleMessage("peer-1", { type: "piece-move", by: "peer-1", pieceId: 5, x: 1, y: 2, z: 3 });

    expect(api.undoLastMove()).toBe("blocked");
  });
});

describe("usePuzzle organize", () => {
  it("broadcasts a state-sync when arranging loose pieces", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const broadcasts: ChannelMessage[] = [];
    const { api } = setupPuzzle({ layout, broadcast: (message) => broadcasts.push(message) });

    api.setNewPieces(layout);
    broadcasts.length = 0;
    api.organizePieces(layout);

    expect(broadcasts.some((message) => message.type === "state-sync")).toBe(true);
  });
});

type RenderOptions = {
  layout?: PuzzleLayout | null;
  broadcast?: (msg: ChannelMessage) => void;
  isHost?: boolean;
};

function setupPuzzle(options: RenderOptions = {}): { api: PuzzleApi } {
  const { result: api } = renderHook(() =>
    usePuzzle({
      broadcast: options.broadcast ?? ((_msg: ChannelMessage) => {}),
      myId: () => "local",
      isHost: () => options.isHost ?? true,
      layout: () => options.layout ?? null,
    }),
  );

  return { api };
}

function registerPieceElement(api: PuzzleApi, pieceId: number) {
  const piece = api.pieces()[pieceId]!;
  const pieceEl = document.createElement("button");
  api.registerPieceElement(pieceId, pieceEl);

  return { piece, pieceEl };
}

function dragPiece(
  api: PuzzleApi,
  piece: NonNullable<ReturnType<PuzzleApi["pieces"]>[number]>,
  options: {
    pointerId: number;
    pointerType?: "mouse" | "pen" | "touch";
    startPoint: { x: number; y: number };
    nextPoint: { x: number; y: number };
    margin: number;
  },
): void {
  api.handlePointerDown(
    makePointerEvent({ pointerId: options.pointerId, pointerType: options.pointerType, clientX: options.startPoint.x, clientY: options.startPoint.y }),
    piece,
    () => options.startPoint,
    options.margin,
  );
  api.handleDragMove(
    makePointerEvent({ pointerId: options.pointerId, pointerType: options.pointerType, clientX: options.nextPoint.x, clientY: options.nextPoint.y }),
    () => options.nextPoint,
    options.margin,
  );
}

function makePointerEvent(init: { pointerId: number; pointerType?: "mouse" | "pen" | "touch"; clientX: number; clientY: number }): PointerEvent {
  return {
    button: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    pointerId: init.pointerId,
    pointerType: init.pointerType ?? "mouse",
    clientX: init.clientX,
    clientY: init.clientY,
    preventDefault: () => {},
    stopPropagation: () => {},
    currentTarget: { setPointerCapture: () => {} },
  } as unknown as PointerEvent;
}

async function flushAnimationFrames(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}
