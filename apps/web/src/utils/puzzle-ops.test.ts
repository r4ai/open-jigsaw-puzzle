import { describe, expect, it } from "vitest";
import { createInitialPieces, createPuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { BoardPiece } from "@open-puzzle/shared/puzzle";
import {
  addPieceRangeSelection,
  arrangeLoosePieces,
  bringSelectedPiecesToFront,
  createEmptySelection,
  getConnectedLoosePieceIds,
  moveSelectedLoosePiecesBy,
  selectByRect,
  selectOnlyPiece,
  snapLoosePiecesToNeighbors,
  togglePieceSelection,
  shouldStartViewportPan,
} from "./puzzle-ops";

describe("arrangeLoosePieces", () => {
  it("places loose pieces without overlap", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout);
    const arranged = arrangeLoosePieces(pieces, layout, seededRandom(7));

    for (let i = 0; i < arranged.length; i++) {
      for (let j = i + 1; j < arranged.length; j++) {
        expect(overlaps(arranged[i]!, arranged[j]!, layout.pieceWidth, layout.pieceHeight)).toBe(false);
      }
    }
  });

  it("does not keep loose pieces in answer order", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout);
    const arranged = arrangeLoosePieces(pieces, layout, seededRandom(11));
    const visualOrder = arranged
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((piece) => piece.id);

    expect(visualOrder).not.toEqual(pieces.map((piece) => piece.id));
  });

  it("leaves locked pieces in place", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout).map((piece, index) =>
      index === 0 ? { ...piece, locked: true } : piece,
    );
    const arranged = arrangeLoosePieces(pieces, layout, seededRandom(13));

    expect(arranged[0]).toEqual(pieces[0]);
  });

  it("keeps connected loose pieces together", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout).map((piece) => {
      if (piece.id === 0) return { ...piece, x: 1800, y: 1400 };
      if (piece.id === 1) return { ...piece, x: 1800 + layout.pieceWidth, y: 1400 };
      if (piece.id === layout.cols) return { ...piece, x: 1800, y: 1400 + layout.pieceHeight };
      return piece;
    });

    const arranged = arrangeLoosePieces(pieces, layout, seededRandom(17));

    expect(arranged[1]!.x - arranged[0]!.x).toBeCloseTo(layout.pieceWidth);
    expect(arranged[1]!.y - arranged[0]!.y).toBeCloseTo(0);
    expect(arranged[layout.cols]!.x - arranged[0]!.x).toBeCloseTo(0);
    expect(arranged[layout.cols]!.y - arranged[0]!.y).toBeCloseTo(layout.pieceHeight);
  });

  it("packs around connected pieces using normal piece-sized rows", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const gap = Math.max(8, Math.min(layout.pieceWidth, layout.pieceHeight) * 0.12);
    const cellHeight = layout.pieceHeight + gap * 2;
    const pieces: BoardPiece[] = [
      boardPiece(0, 1800, 1400, layout),
      boardPiece(1, 1800 + layout.pieceWidth, 1400, layout),
      boardPiece(layout.cols, 1800, 1400 + layout.pieceHeight, layout),
      boardPiece(layout.cols + 1, 1800 + layout.pieceWidth, 1400 + layout.pieceHeight, layout),
      boardPiece(3, 2600, 1400, layout),
      boardPiece(4, 2800, 1400, layout),
    ];

    const arranged = arrangeLoosePieces(pieces, layout, () => 0.99);
    const topY = Math.min(...arranged.map((piece) => piece.y));
    const rows = arranged.map((piece) => Math.round((piece.y - topY) / cellHeight));

    expect(rows).toEqual([0, 0, 1, 1, 0, 1]);
  });
});

describe("viewport pan helpers", () => {
  it("keeps left-button panning from starting on loose pieces", () => {
    const piece = document.createElement("button");
    piece.className = "piece";

    expect(shouldStartViewportPan(0, piece)).toBe(false);
  });

  it("allows middle-button panning even from loose pieces", () => {
    const piece = document.createElement("button");
    piece.className = "piece";

    expect(shouldStartViewportPan(1, piece)).toBe(true);
  });
});

describe("selection helpers", () => {
  it("selects, toggles, and range-adds pieces", () => {
    const one = selectOnlyPiece(2);
    expect([...one.pieceIds]).toEqual([2]);
    expect(one.imageOverlaySelected).toBe(false);

    const added = togglePieceSelection(one, 5);
    expect([...added.pieceIds].sort((a, b) => a - b)).toEqual([2, 5]);

    const removed = togglePieceSelection(added, 2);
    expect([...removed.pieceIds]).toEqual([5]);

    const ranged = addPieceRangeSelection({ ...removed, lastSelectedPieceId: 3 }, 6);
    expect([...ranged.pieceIds].sort((a, b) => a - b)).toEqual([3, 4, 5, 6]);
  });

  it("selects pieces and image overlay intersecting a rectangle", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout).map((piece, index) => ({
      ...piece,
      x: index * 100,
      y: 0,
    }));

    const selection = selectByRect(
      pieces,
      layout,
      { x: 50, y: 0, width: 180, height: 100 },
      { x: 200, y: 20, width: 1200, height: 800 },
    );

    expect(selection.pieceIds.has(0)).toBe(true);
    expect(selection.pieceIds.has(1)).toBe(true);
    expect(selection.imageOverlaySelected).toBe(true);
  });

  it("moves selected loose pieces while leaving locked pieces in place", () => {
    const pieces: BoardPiece[] = [
      { id: 0, targetX: 0, targetY: 0, x: 0, y: 0, z: 1, locked: false },
      { id: 1, targetX: 0, targetY: 0, x: 10, y: 10, z: 2, locked: true },
      { id: 2, targetX: 0, targetY: 0, x: 20, y: 20, z: 3, locked: false },
    ];

    expect(moveSelectedLoosePiecesBy(pieces, new Set([0, 1]), { x: 5, y: 7 })).toEqual([
      { ...pieces[0]!, x: 5, y: 7 },
      pieces[1],
      pieces[2],
    ]);
  });

  it("brings selected pieces to front while preserving relative z order", () => {
    const pieces: BoardPiece[] = [
      { id: 0, targetX: 0, targetY: 0, x: 0, y: 0, z: 10, locked: false },
      { id: 1, targetX: 0, targetY: 0, x: 0, y: 0, z: 2, locked: false },
      { id: 2, targetX: 0, targetY: 0, x: 0, y: 0, z: 5, locked: false },
    ];
    const next = bringSelectedPiecesToFront(pieces, new Set([0, 2]));

    expect(next.find((piece) => piece.id === 2)?.z).toBe(11);
    expect(next.find((piece) => piece.id === 0)?.z).toBe(12);
    expect(next.find((piece) => piece.id === 1)?.z).toBe(2);
  });

  it("creates an empty selection", () => {
    expect(createEmptySelection()).toMatchObject({ imageOverlaySelected: false, lastSelectedPieceId: null });
  });
});

describe("piece connection helpers", () => {
  it("snaps matching neighboring pieces outside the frame", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout).map((piece) => {
      if (piece.id === 0) return { ...piece, x: 2000, y: 1600 };
      if (piece.id === 1) return { ...piece, x: 2000 + layout.pieceWidth - 6, y: 1603 };
      return piece;
    });

    const snapped = snapLoosePiecesToNeighbors(pieces, new Set([1]), layout, 10);

    expect(snapped[1]).toMatchObject({
      x: pieces[0]!.x + layout.pieceWidth,
      y: pieces[0]!.y,
      locked: false,
    });
  });

  it("collects a snapped loose cluster from one dragged piece", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout).map((piece) => {
      if (piece.id === 0) return { ...piece, x: 1800, y: 1400 };
      if (piece.id === 1) return { ...piece, x: 1800 + layout.pieceWidth, y: 1400 };
      if (piece.id === layout.cols) return { ...piece, x: 1800, y: 1400 + layout.pieceHeight };
      return piece;
    });

    expect([...getConnectedLoosePieceIds(pieces, new Set([0]), layout)].sort((a, b) => a - b)).toEqual([
      0,
      1,
      layout.cols,
    ]);
  });
});

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function overlaps(a: BoardPiece, b: BoardPiece, width: number, height: number): boolean {
  return a.x < b.x + width && a.x + width > b.x && a.y < b.y + height && a.y + height > b.y;
}

function boardPiece(id: number, x: number, y: number, layout: ReturnType<typeof createPuzzleLayout>): BoardPiece {
  const geometry = layout.pieces[id]!;
  return { id, targetX: geometry.targetX, targetY: geometry.targetY, x, y, z: id + 1, locked: false };
}
