import { describe, expect, it } from "vitest";
import { createInitialPieces, createPuzzleLayout, factorGrid, getWorkspaceMargin, isComplete, shouldSnap, snapPiece } from "./puzzle";

describe("puzzle geometry", () => {
  it.each([48, 96, 192] as const)("creates exactly %s pieces", (difficulty) => {
    const layout = createPuzzleLayout(difficulty, 1200, 800);

    expect(layout.rows * layout.cols).toBe(difficulty);
    expect(layout.pieces).toHaveLength(difficulty);
  });

  it("chooses a grid close to the image aspect ratio", () => {
    expect(factorGrid(48, 1600, 900)).toEqual({ rows: 6, cols: 8 });
    expect(factorGrid(48, 900, 1600)).toEqual({ rows: 8, cols: 6 });
  });

  it("creates complementary jigsaw edges between neighboring pieces", () => {
    const layout = createPuzzleLayout(48, 1200, 800);

    for (const piece of layout.pieces) {
      if (piece.col < layout.cols - 1) {
        const right = layout.pieces[piece.id + 1];
        expect(piece.edges.right).toBe(-right.edges.left);
      }

      if (piece.row < layout.rows - 1) {
        const below = layout.pieces[piece.id + layout.cols];
        expect(piece.edges.bottom).toBe(-below.edges.top);
      }
    }
  });

  it("snaps pieces within the threshold", () => {
    const piece = { id: 1, x: 98, y: 103, z: 1, targetX: 100, targetY: 100, locked: false };

    expect(shouldSnap(piece, 5)).toBe(true);
    expect(snapPiece(piece, 5)).toMatchObject({ x: 100, y: 100, locked: true });
  });

  it("detects completion only when every piece is locked", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const pieces = createInitialPieces(layout);

    expect(isComplete(pieces)).toBe(false);
    expect(isComplete(pieces.map((piece) => ({ ...piece, locked: true })))).toBe(true);
  });

  it("scatters initial pieces around the frame instead of inside it", () => {
    const layout = createPuzzleLayout(96, 1200, 800);
    const pieces = createInitialPieces(layout);
    const margin = getWorkspaceMargin(layout);
    const outsideFrame = pieces.filter(
      (piece) =>
        piece.x + layout.pieceWidth <= 0 ||
        piece.x >= layout.boardWidth ||
        piece.y + layout.pieceHeight <= 0 ||
        piece.y >= layout.boardHeight,
    );

    expect(pieces).toHaveLength(layout.pieces.length);
    expect(outsideFrame.length).toBe(pieces.length);
    expect(pieces.every((piece) => Number.isFinite(piece.x) && Number.isFinite(piece.y))).toBe(true);
    expect(pieces.every((piece) => piece.x >= -margin - layout.pieceWidth && piece.x <= layout.boardWidth + margin)).toBe(true);
    expect(pieces.every((piece) => piece.y >= -margin - layout.pieceHeight && piece.y <= layout.boardHeight + margin)).toBe(true);
  });

  it("indexes initial pieces by their id", () => {
    const layout = createPuzzleLayout(192, 1200, 800);
    const pieces = createInitialPieces(layout);

    expect(pieces.map((piece) => piece.id)).toEqual(layout.pieces.map((piece) => piece.id));
  });
});
