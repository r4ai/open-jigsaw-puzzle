import { describe, expect, it } from "vitest";
import { createInitialPieces, createPuzzleLayout } from "@open-puzzle/shared/puzzle";
import type { BoardPiece } from "@open-puzzle/shared/puzzle";
import { arrangeLoosePieces } from "./puzzle-ops";

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
