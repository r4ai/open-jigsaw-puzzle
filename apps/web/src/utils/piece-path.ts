import type { PieceEdgeProfile, PieceGeometry } from "@open-puzzle/shared/puzzle";

export function createPiecePath(
  width: number,
  height: number,
  geometry: Pick<PieceGeometry, "edges" | "edgeProfiles">,
  tabSize: number,
): string {
  return [
    "M 0 0",
    createEdgePath(0, 0, width, 0, geometry.edges.top, geometry.edgeProfiles.top, 0, -1, tabSize),
    createEdgePath(width, 0, width, height, geometry.edges.right, geometry.edgeProfiles.right, 1, 0, tabSize),
    createEdgePath(width, height, 0, height, geometry.edges.bottom, geometry.edgeProfiles.bottom, 0, 1, tabSize),
    createEdgePath(0, height, 0, 0, geometry.edges.left, geometry.edgeProfiles.left, -1, 0, tabSize),
    "Z",
  ].join(" ");
}

function createEdgePath(
  startX: number, startY: number,
  endX: number, endY: number,
  edge: number,
  profile: PieceEdgeProfile | null,
  normalX: number, normalY: number,
  tabSize: number,
): string {
  if (edge === 0) return `L ${r(endX)} ${r(endY)}`;
  const dx = endX - startX;
  const dy = endY - startY;
  const offset = edge * tabSize;
  const p = profile ?? fallbackProfile;
  const point = (t: number, depth = 0) => ({
    x: startX + dx * t + normalX * offset * depth,
    y: startY + dy * t + normalY * offset * depth,
  });
  const pt = (t: number, depth = 0) => formatPoint(point(t, depth));
  const c = (
    fromT: number,
    fromDepth: number,
    toT: number,
    toDepth: number,
    curve = 0,
  ): string => {
    const span = (toT - fromT) * 0.48;
    const cp1 = point(fromT + span, fromDepth + curve);
    const cp2 = point(toT - span, toDepth - curve);
    return `C ${formatPoint(cp1)} ${formatPoint(cp2)} ${pt(toT, toDepth)}`;
  };

  return [
    `L ${pt(p.shoulderStart)}`,
    c(p.shoulderStart, 0, p.headStart, p.shoulderDepth, p.startCurve),
    c(p.headStart, p.shoulderDepth, p.neckStart, p.neckDepth, 0.05),
    c(p.neckStart, p.neckDepth, p.headStart + (p.headEnd - p.headStart) * 0.36, p.headDepth, 0.12),
    c(p.headStart + (p.headEnd - p.headStart) * 0.36, p.headDepth, p.headStart + (p.headEnd - p.headStart) * 0.64, p.headDepth, 0),
    c(p.headStart + (p.headEnd - p.headStart) * 0.64, p.headDepth, p.neckEnd, p.neckDepth, -0.12),
    c(p.neckEnd, p.neckDepth, p.headEnd, p.waistDepth, -0.04),
    c(p.headEnd, p.waistDepth, p.shoulderEnd, 0, p.endCurve),
    `L ${r(endX)} ${r(endY)}`,
  ].join(" ");
}

const fallbackProfile: PieceEdgeProfile = {
  shoulderStart: 0.24,
  neckStart: 0.43,
  headStart: 0.36,
  headEnd: 0.64,
  neckEnd: 0.57,
  shoulderEnd: 0.76,
  neckDepth: 0.45,
  headDepth: 1.03,
  waistDepth: 0.35,
  shoulderDepth: 0,
  startCurve: 0,
  endCurve: 0,
  reverse: false,
};

function formatPoint(point: { x: number; y: number }): string {
  return `${r(point.x)} ${r(point.y)}`;
}

function r(value: number): number {
  return Math.round(value * 100) / 100;
}
