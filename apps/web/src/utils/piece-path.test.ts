import { describe, expect, it } from "vitest";
import { createPuzzleLayout } from "@open-puzzle/shared/puzzle";
import { createPiecePath, samplePieceEdge } from "./piece-path";

describe("piece paths", () => {
  it("creates finite interlocking SVG paths", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const tabSize = layout.tabSize;
    const path = createPiecePath(layout.pieceWidth, layout.pieceHeight, layout.pieces[0]!, tabSize);

    expect(path).toContain("C");
    expect(path).not.toMatch(/NaN|Infinity/);
  });

  it("samples matching contours for neighboring horizontal edges", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const tabSize = layout.tabSize;
    const left = layout.pieces[0]!;
    const right = layout.pieces[1]!;
    const leftEdge = samplePieceEdge(layout.pieceWidth, layout.pieceHeight, left, "right", tabSize);
    const rightEdge = samplePieceEdge(layout.pieceWidth, layout.pieceHeight, right, "left", tabSize).reverse();

    expect(leftEdge).toHaveLength(rightEdge.length);
    leftEdge.forEach((point, index) => {
      expect(point.x).toBeCloseTo(rightEdge[index]!.x + layout.pieceWidth, 6);
      expect(point.y).toBeCloseTo(rightEdge[index]!.y, 6);
    });
  });

  it("samples matching contours for neighboring vertical edges", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const tabSize = layout.tabSize;
    const top = layout.pieces[0]!;
    const bottom = layout.pieces[layout.cols]!;
    const topEdge = samplePieceEdge(layout.pieceWidth, layout.pieceHeight, top, "bottom", tabSize);
    const bottomEdge = samplePieceEdge(layout.pieceWidth, layout.pieceHeight, bottom, "top", tabSize).reverse();

    expect(topEdge).toHaveLength(bottomEdge.length);
    topEdge.forEach((point, index) => {
      expect(point.x).toBeCloseTo(bottomEdge[index]!.x, 6);
      expect(point.y).toBeCloseTo(bottomEdge[index]!.y + layout.pieceHeight, 6);
    });
  });

  it("draws a necked interlocking tab instead of a simple round bump", () => {
    const layout = createPuzzleLayout(48, 1200, 800);
    const piece = layout.pieces.find((candidate) => candidate.edges.right !== 0)!;
    const edge = samplePieceEdge(layout.pieceWidth, layout.pieceHeight, piece, "right", layout.tabSize, 12);
    const signedDepths = edge.map((point) => ((point.x - layout.pieceWidth) / layout.tabSize) * piece.edges.right);

    expect(Math.max(...signedDepths)).toBeGreaterThan(0.85);
    expect(Math.min(...signedDepths)).toBeLessThan(-0.08);
  });
});
