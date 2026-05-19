import { afterEach, describe, expect, it } from "vitest";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createPuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
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
});

function renderPuzzle(onRender: (api: PuzzleApi) => void): void {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(<PuzzleHarness onRender={onRender} />);
  });
}

function PuzzleHarness({ onRender }: { onRender: (api: PuzzleApi) => void }) {
  const api = usePuzzle({
    broadcast: (_msg: ChannelMessage) => {},
    myId: "local",
    isHost: true,
    layout: null,
  });

  useEffect(() => {
    onRender(api);
  });

  return null;
}
