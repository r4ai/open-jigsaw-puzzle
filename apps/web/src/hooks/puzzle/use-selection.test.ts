import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@solidjs/testing-library";
import { createPuzzleLayout } from "@open-jigsaw-puzzle/shared/puzzle";
import type { BoardPiece } from "@open-jigsaw-puzzle/shared/puzzle";
import type { ChannelMessage } from "@open-jigsaw-puzzle/shared/protocol";
import { createInitialPieces } from "@open-jigsaw-puzzle/shared/puzzle";
import { useSelection } from "./use-selection";

function setup(broadcast: (msg: ChannelMessage) => void = () => {}, pieces: BoardPiece[] = []) {
  const { result } = renderHook(() =>
    useSelection({ broadcast, myId: () => "local", getPieces: () => pieces }),
  );
  return result;
}

function makePointerEvent(init: { pointerId: number; clientX: number; clientY: number; shiftKey?: boolean }): PointerEvent {
  return {
    button: 0,
    shiftKey: init.shiftKey ?? false,
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

describe("useSelection", () => {
  it("coalesces selection presence broadcasts into one animation frame", async () => {
    const broadcast = vi.fn();
    const selection = setup(broadcast);

    selection.setSelection({ pieceIds: new Set([1]), imageOverlaySelected: false, lastSelectedPieceId: 1 });
    selection.setSelection({ pieceIds: new Set([1, 2]), imageOverlaySelected: false, lastSelectedPieceId: 2 });
    expect(broadcast).not.toHaveBeenCalled();

    await flushAnimationFrames();
    const presence = broadcast.mock.calls.map((c) => c[0]).filter((m) => m.type === "selection-presence");
    expect(presence).toHaveLength(1);
    expect(presence[0]).toMatchObject({ pieceIds: [1, 2] });
    expect(selection.selectedPieceIds()).toEqual(new Set([1, 2]));
  });

  it("selects loose pieces overlapped by the rubber-band rectangle", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout).map((p) => (p.id === 0 ? { ...p, x: 10, y: 10 } : p));
    const target = pieces[0]!;
    const selection = setup(() => {}, pieces);

    selection.handleSelectionBoxPointerDown(
      makePointerEvent({ pointerId: 1, clientX: 0, clientY: 0, shiftKey: true }),
      () => ({ x: target.x - 5, y: target.y - 5 }),
    );
    selection.handleSelectionBoxMove(
      makePointerEvent({ pointerId: 1, clientX: 0, clientY: 0 }),
      () => ({ x: target.x + layout.pieceWidth, y: target.y + layout.pieceHeight }),
    );
    selection.handleSelectionBoxEnd(layout, null, 0, 1);

    expect(selection.selectedPieceIds().has(0)).toBe(true);
    expect(selection.selectionBox()).toBeNull();
  });

  it("upserts and removes remote selections", () => {
    const selection = setup();

    selection.upsertRemoteSelection({ participantId: "p", pieceIds: [1], imageOverlaySelected: false });
    expect(selection.remoteSelections()).toHaveLength(1);

    selection.upsertRemoteSelection({ participantId: "p", pieceIds: [2, 3], imageOverlaySelected: true });
    expect(selection.remoteSelections()).toEqual([
      { participantId: "p", pieceIds: [2, 3], imageOverlaySelected: true },
    ]);

    selection.removeRemoteSelection("p");
    expect(selection.remoteSelections()).toEqual([]);
  });
});
