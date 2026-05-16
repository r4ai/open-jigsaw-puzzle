import type { PieceGeometry } from "@open-puzzle/shared/puzzle";

export function createPiecePath(
  width: number,
  height: number,
  edges: PieceGeometry["edges"],
  tabSize: number,
): string {
  return [
    "M 0 0",
    createEdgePath(0, 0, width, 0, edges.top, 0, -1, tabSize),
    createEdgePath(width, 0, width, height, edges.right, 1, 0, tabSize),
    createEdgePath(width, height, 0, height, edges.bottom, 0, 1, tabSize),
    createEdgePath(0, height, 0, 0, edges.left, -1, 0, tabSize),
    "Z",
  ].join(" ");
}

function createEdgePath(
  startX: number, startY: number,
  endX: number, endY: number,
  edge: number,
  normalX: number, normalY: number,
  tabSize: number,
): string {
  if (edge === 0) return `L ${r(endX)} ${r(endY)}`;
  const dx = endX - startX;
  const dy = endY - startY;
  const offset = edge * tabSize;
  const pt = (t: number, ns = 0) =>
    `${r(startX + dx * t + normalX * offset * ns)} ${r(startY + dy * t + normalY * offset * ns)}`;
  return [
    `L ${pt(0.31)}`,
    `C ${pt(0.36)} ${pt(0.38, 0.45)} ${pt(0.43, 0.48)}`,
    `C ${pt(0.44, 1.03)} ${pt(0.56, 1.03)} ${pt(0.57, 0.48)}`,
    `C ${pt(0.62, 0.45)} ${pt(0.64)} ${pt(0.69)}`,
    `L ${r(endX)} ${r(endY)}`,
  ].join(" ");
}

function r(value: number): number {
  return Math.round(value * 100) / 100;
}
