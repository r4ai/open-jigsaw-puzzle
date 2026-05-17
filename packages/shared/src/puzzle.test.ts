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

  it("keeps outside puzzle edges straight", () => {
    const layout = createPuzzleLayout(48, 1200, 800);

    for (const piece of layout.pieces) {
      if (piece.row === 0) {
        expect(piece.edges.top).toBe(0);
        expect(piece.edgeProfiles.top).toBeNull();
      }
      if (piece.col === layout.cols - 1) {
        expect(piece.edges.right).toBe(0);
        expect(piece.edgeProfiles.right).toBeNull();
      }
      if (piece.row === layout.rows - 1) {
        expect(piece.edges.bottom).toBe(0);
        expect(piece.edgeProfiles.bottom).toBeNull();
      }
      if (piece.col === 0) {
        expect(piece.edges.left).toBe(0);
        expect(piece.edgeProfiles.left).toBeNull();
      }
    }
  });

  it("shares reversed interlocking edge profiles between neighboring pieces", () => {
    const layout = createPuzzleLayout(48, 1200, 800);

    for (const piece of layout.pieces) {
      if (piece.col < layout.cols - 1) {
        const right = layout.pieces[piece.id + 1]!;
        expect(piece.edgeProfiles.right).not.toBeNull();
        expect(right.edgeProfiles.left).toMatchObject({
          center: 1 - piece.edgeProfiles.right!.center,
          neckWidth: piece.edgeProfiles.right!.neckWidth,
          headWidth: piece.edgeProfiles.right!.headWidth,
          tabDepth: piece.edgeProfiles.right!.tabDepth,
          waistDepth: piece.edgeProfiles.right!.waistDepth,
          shoulderWidth: piece.edgeProfiles.right!.shoulderWidth,
          skew: -piece.edgeProfiles.right!.skew,
          reverse: true,
        });
      }

      if (piece.row < layout.rows - 1) {
        const below = layout.pieces[piece.id + layout.cols]!;
        expect(piece.edgeProfiles.bottom).not.toBeNull();
        expect(below.edgeProfiles.top).toMatchObject({
          center: 1 - piece.edgeProfiles.bottom!.center,
          neckWidth: piece.edgeProfiles.bottom!.neckWidth,
          headWidth: piece.edgeProfiles.bottom!.headWidth,
          tabDepth: piece.edgeProfiles.bottom!.tabDepth,
          waistDepth: piece.edgeProfiles.bottom!.waistDepth,
          shoulderWidth: piece.edgeProfiles.bottom!.shoulderWidth,
          skew: -piece.edgeProfiles.bottom!.skew,
          reverse: true,
        });
      }
    }
  });

  it("creates finite classic tab and blank profile values", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const profiles = layout.pieces.flatMap((piece) =>
      [piece.edgeProfiles.top, piece.edgeProfiles.right, piece.edgeProfiles.bottom, piece.edgeProfiles.left].filter((profile) => profile !== null),
    );

    expect(layout.tabSize).toBeCloseTo(Math.min(layout.pieceWidth, layout.pieceHeight) * 0.24);
    expect(profiles.length).toBeGreaterThan(0);
    for (const profile of profiles) {
      expect(Object.values(profile).every((value) => typeof value === "boolean" || Number.isFinite(value))).toBe(true);
      expect(profile.center).toBeGreaterThanOrEqual(0.34);
      expect(profile.center).toBeLessThanOrEqual(0.66);
      expect(profile.neckWidth).toBeGreaterThanOrEqual(0.16);
      expect(profile.neckWidth).toBeLessThanOrEqual(0.2);
      expect(profile.headWidth).toBeGreaterThan(profile.neckWidth);
      expect(profile.tabDepth).toBeGreaterThan(0.89);
      expect(profile.waistDepth).toBeGreaterThan(0.11);
      expect(profile.shoulderWidth).toBeGreaterThan(profile.headWidth);
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
