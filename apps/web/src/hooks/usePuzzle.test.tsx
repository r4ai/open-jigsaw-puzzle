import { afterEach, describe, expect, it } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createPuzzleLayout, type PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { usePuzzle } from "./usePuzzle";

type PuzzleApi = ReturnType<typeof usePuzzle>;

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

describe("usePuzzle image lifecycle", () => {
  it("recreates pieces from the new layout when an image is replaced", () => {
    const firstLayout = createPuzzleLayout(48, 1200, 800);
    const nextLayout = createPuzzleLayout(48, 800, 1200);
    let api: PuzzleApi | null = null;

    renderPuzzle((nextApi) => {
      api = nextApi;
    });

    act(() => {
      api!.setNewPieces(firstLayout);
    });
    expect(api!.piecesRef.current[1]?.targetX).toBe(firstLayout.pieces[1]?.targetX);

    act(() => {
      api!.receiveImage(nextLayout);
    });

    expect(api!.piecesRef.current).toHaveLength(nextLayout.pieces.length);
    expect(api!.piecesRef.current[1]?.targetX).toBe(nextLayout.pieces[1]?.targetX);
    expect(api!.piecesRef.current[1]?.targetX).not.toBe(firstLayout.pieces[1]?.targetX);
  });
});

describe("usePuzzle peer messages", () => {
  it("applies batched piece moves in one update", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    let api: PuzzleApi | null = null;

    renderPuzzle((nextApi) => {
      api = nextApi;
    });

    act(() => {
      api!.setNewPieces(layout);
      api!.handleMessage("peer-1", {
        type: "piece-moves",
        by: "peer-1",
        moves: [
          { pieceId: 0, x: 11, y: 22, z: 33 },
          { pieceId: 1, x: 44, y: 55, z: 66 },
        ],
      });
    });

    expect(api!.piecesRef.current[0]).toMatchObject({ x: 11, y: 22, z: 33 });
    expect(api!.piecesRef.current[1]).toMatchObject({ x: 44, y: 55, z: 66 });
  });

  it("applies batched piece-locks remotely", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    let api: PuzzleApi | null = null;

    renderPuzzle((nextApi) => {
      api = nextApi;
    }, { layout });

    act(() => {
      api!.setNewPieces(layout);
      api!.handleMessage("peer-1", {
        type: "piece-locks",
        by: "peer-1",
        locks: [
          { pieceId: 0, x: 7, y: 8, z: 9 },
          { pieceId: 2, x: 10, y: 11, z: 12 },
        ],
      });
    });

    expect(api!.piecesRef.current[0]).toMatchObject({ x: 7, y: 8, z: 9, locked: true });
    expect(api!.piecesRef.current[2]).toMatchObject({ x: 10, y: 11, z: 12, locked: true });
    expect(api!.piecesRef.current[1]?.locked).toBe(false);
  });
});

describe("usePuzzle local drag", () => {
  it("updates DOM transform without mutating pieces state during drag", async () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    let api: PuzzleApi | null = null;
    const broadcasts: ChannelMessage[] = [];

    renderPuzzle((nextApi) => {
      api = nextApi;
    }, { layout, broadcast: (m) => broadcasts.push(m) });

    act(() => {
      api!.setNewPieces(layout);
    });

    const pieceEl = document.createElement("button");
    api!.registerPieceElement(0, pieceEl);

    const startPiece = api!.piecesRef.current[0]!;
    const startX = startPiece.x;
    const startY = startPiece.y;

    const pointerDown = makePointerEvent({ pointerId: 7, clientX: 0, clientY: 0 });
    act(() => {
      api!.handlePointerDown(pointerDown, startPiece, () => ({ x: 0, y: 0 }), 50);
    });

    const pointerMove = makePointerEvent({ pointerId: 7, clientX: 30, clientY: 40 });
    act(() => {
      api!.handleDragMove(pointerMove, () => ({ x: 30, y: 40 }), 50);
    });
    await flushAnimationFrames();

    // ピース state は不変 (DOM のみ更新)
    expect(api!.piecesRef.current[0]?.x).toBe(startX);
    expect(api!.piecesRef.current[0]?.y).toBe(startY);
    expect(pieceEl.style.transform).toBe(`translate3d(${50 + startX + 30}px, ${50 + startY + 40}px, 0)`);
    expect(broadcasts.some((m) => m.type === "piece-move" || m.type === "piece-moves")).toBe(true);

    act(() => {
      api!.handleDragEnd(1, 7);
    });

    // 確定で React state にライブ座標が反映される (snap 閾値 1 では位置はほぼそのまま)
    expect(api!.piecesRef.current[0]?.x).toBeCloseTo(startX + 30);
    expect(api!.piecesRef.current[0]?.y).toBeCloseTo(startY + 40);
  });
});

type RenderOptions = {
  layout?: PuzzleLayout | null;
  broadcast?: (msg: ChannelMessage) => void;
};

function renderPuzzle(onRender: (api: PuzzleApi) => void, options: RenderOptions = {}): void {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(<PuzzleHarness onRender={onRender} options={options} />);
  });
}

function PuzzleHarness({ onRender, options }: { onRender: (api: PuzzleApi) => void; options: RenderOptions }) {
  const api = usePuzzle({
    broadcast: options.broadcast ?? ((_msg: ChannelMessage) => {}),
    myId: "local",
    isHost: true,
    layout: options.layout ?? null,
  });

  useEffect(() => {
    onRender(api);
  });

  return null;
}

function makePointerEvent(init: { pointerId: number; clientX: number; clientY: number }): React.PointerEvent {
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
    currentTarget: { setPointerCapture: () => {} } as unknown as React.PointerEvent["currentTarget"],
  } as unknown as React.PointerEvent;
}

async function flushAnimationFrames(): Promise<void> {
  // jsdom の requestAnimationFrame は ~16ms 後に setTimeout で実装される。
  // 確実に flush するために少し待つ。
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
