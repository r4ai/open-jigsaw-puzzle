import { cleanup, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import { PuzzleBoard } from "./puzzle-board";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PuzzleBoard image overlay toolbar", () => {
  it("recomputes placement after the toolbar is measured", async () => {
    const viewport = makeViewport(300, 240);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(36);

    render(() => (
      <PuzzleBoard
        layout={layout}
        imageDataUrl="data:image/png;base64,"
        pieces={[]}
        zoom={1}
        pan={{ x: 0, y: 80 }}
        panning={false}
        margin={0}
        complete={false}
        loadingSummary="loading"
        remoteCursors={[]}
        activeRemoteCursorIds={new Set()}
        selectedPieceIds={new Set()}
        imageOverlaySelected={true}
        selectionBox={null}
        remoteSelections={[]}
        myId="me"
        setViewportEl={() => {}}
        setWorldEl={() => {}}
        getViewportEl={() => viewport}
        imageOverlayPosition={{ x: 0, y: 0 }}
        imageOverlayLocked={false}
        imageOverlayOpacity={1}
        onToggleImageLock={() => {}}
        onChangeImageOpacity={() => {}}
        onImageOverlayPointerDown={() => {}}
        onPiecePointerDown={() => {}}
        onPointerMove={() => {}}
        onPointerUp={() => {}}
        onPointerCancel={() => {}}
        onPointerLeave={() => {}}
        onViewportPointerDown={() => {}}
        onWheel={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onResetZoom={() => {}}
        onApplyPinch={() => {}}
        onSetPinching={() => {}}
        registerPieceElement={() => {}}
      />
    ));

    await Promise.resolve();

    expect(screen.getByRole("toolbar", { name: "画像オーバーレイ" })).toHaveStyle({
      left: "100px",
      top: "36px",
    });
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

function makeViewport(width: number, height: number): HTMLDivElement {
  const viewport = document.createElement("div");
  Object.defineProperties(viewport, {
    clientWidth: { value: width },
    clientHeight: { value: height },
  });
  return viewport;
}
