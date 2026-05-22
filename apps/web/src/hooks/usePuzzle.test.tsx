import { describe, expect, it } from "vitest";
import { renderHook } from "@solidjs/testing-library";
import { createPuzzleLayout, type PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { usePuzzle } from "./usePuzzle";

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
});

type RenderOptions = {
  layout?: PuzzleLayout | null;
  broadcast?: (msg: ChannelMessage) => void;
};

function setupPuzzle(options: RenderOptions = {}): { api: PuzzleApi } {
  const { result: api } = renderHook(() =>
    usePuzzle({
      broadcast: options.broadcast ?? ((_msg: ChannelMessage) => {}),
      myId: () => "local",
      isHost: () => true,
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
    startPoint: { x: number; y: number };
    nextPoint: { x: number; y: number };
    margin: number;
  },
): void {
  api.handlePointerDown(
    makePointerEvent({ pointerId: options.pointerId, clientX: options.startPoint.x, clientY: options.startPoint.y }),
    piece,
    () => options.startPoint,
    options.margin,
  );
  api.handleDragMove(
    makePointerEvent({ pointerId: options.pointerId, clientX: options.nextPoint.x, clientY: options.nextPoint.y }),
    () => options.nextPoint,
    options.margin,
  );
}

function makePointerEvent(init: { pointerId: number; clientX: number; clientY: number }): PointerEvent {
  return {
    button: 0,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    pointerId: init.pointerId,
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
