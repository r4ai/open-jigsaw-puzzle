import type { PieceEdgeProfile, PieceGeometry } from "@open-jigsaw-puzzle/shared/puzzle";

type Point = { x: number; y: number };
type EdgeSide = "top" | "right" | "bottom" | "left";

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

export function samplePieceEdge(
  width: number,
  height: number,
  geometry: Pick<PieceGeometry, "edges" | "edgeProfiles">,
  side: EdgeSide,
  tabSize: number,
  samplesPerSegment = 4,
): Point[] {
  const spec = edgeSpec(width, height, geometry, side);
  if (spec.edge === 0) return [spec.start, spec.end];
  return sampleEdge(spec.start, spec.end, spec.edge, spec.profile, spec.normalX, spec.normalY, tabSize, samplesPerSegment);
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
  const segments = createCurvedSegments({ x: startX, y: startY }, { x: endX, y: endY }, edge, profile, normalX, normalY, tabSize);
  return segments.map((segment) => [
    `C ${formatPoint(segment.cp1)} ${formatPoint(segment.cp2)} ${formatPoint(segment.to)}`,
  ]).flat().join(" ").replace(/^/, `L ${formatPoint(segments[0]!.from)} `) + ` L ${r(endX)} ${r(endY)}`;
}

function edgeSpec(width: number, height: number, geometry: Pick<PieceGeometry, "edges" | "edgeProfiles">, side: EdgeSide) {
  switch (side) {
    case "top":
      return { start: { x: 0, y: 0 }, end: { x: width, y: 0 }, edge: geometry.edges.top, profile: geometry.edgeProfiles.top, normalX: 0, normalY: -1 };
    case "right":
      return { start: { x: width, y: 0 }, end: { x: width, y: height }, edge: geometry.edges.right, profile: geometry.edgeProfiles.right, normalX: 1, normalY: 0 };
    case "bottom":
      return { start: { x: width, y: height }, end: { x: 0, y: height }, edge: geometry.edges.bottom, profile: geometry.edgeProfiles.bottom, normalX: 0, normalY: 1 };
    case "left":
      return { start: { x: 0, y: height }, end: { x: 0, y: 0 }, edge: geometry.edges.left, profile: geometry.edgeProfiles.left, normalX: -1, normalY: 0 };
  }
}

function createCurvedSegments(
  start: Point,
  end: Point,
  edge: number,
  profile: PieceEdgeProfile | null,
  normalX: number,
  normalY: number,
  tabSize: number,
): Array<{ from: Point; cp1: Point; cp2: Point; to: Point }> {
  const p = profile ?? fallbackProfile;
  const knots = createInterlockKnots(p);
  const point = edgePointFactory(start, end, edge, normalX, normalY, tabSize);
  const segments: Array<{ from: Point; cp1: Point; cp2: Point; to: Point }> = [];

  for (let index = 0; index < knots.length - 1; index += 1) {
    const from = knots[index]!;
    const to = knots[index + 1]!;
    const span = (to.t - from.t) / 3;
    const fromSlope = knotSlope(knots, index);
    const toSlope = knotSlope(knots, index + 1);
    segments.push({
      from: point(from.t, from.depth),
      cp1: point(from.t + span, from.depth + fromSlope * span),
      cp2: point(to.t - span, to.depth - toSlope * span),
      to: point(to.t, to.depth),
    });
  }

  return segments;
}

function createInterlockKnots(profile: PieceEdgeProfile): Array<{ t: number; depth: number }> {
  const shoulderHalf = profile.shoulderWidth / 2;
  const headHalf = profile.headWidth / 2;
  const neckHalf = profile.neckWidth / 2;
  const center = clamp(profile.center, 0.34, 0.66);
  const leftShoulder = clamp(center - shoulderHalf, 0.08, 0.32);
  const leftHead = clamp(center - headHalf - profile.skew * 0.25, leftShoulder + 0.04, center - neckHalf - 0.03);
  const leftNeck = clamp(center - neckHalf + profile.skew * 0.15, leftHead + 0.035, center - 0.035);
  const rightNeck = clamp(center + neckHalf + profile.skew * 0.15, center + 0.035, center + headHalf - 0.035);
  const rightHead = clamp(center + headHalf - profile.skew * 0.25, rightNeck + 0.035, center + shoulderHalf - 0.04);
  const rightShoulder = clamp(center + shoulderHalf, 0.68, 0.92);
  const crownLeft = center - profile.headWidth * 0.14;
  const crownRight = center + profile.headWidth * 0.14;
  const neckDepth = 0.28;

  return [
    { t: leftShoulder, depth: 0 },
    { t: leftHead, depth: -profile.waistDepth },
    { t: leftNeck, depth: neckDepth },
    { t: crownLeft, depth: profile.tabDepth },
    { t: center, depth: profile.tabDepth * 1.06 },
    { t: crownRight, depth: profile.tabDepth },
    { t: rightNeck, depth: neckDepth },
    { t: rightHead, depth: -profile.waistDepth },
    { t: rightShoulder, depth: 0 },
  ];
}

function knotSlope(knots: Array<{ t: number; depth: number }>, index: number): number {
  const previous = knots[Math.max(0, index - 1)]!;
  const next = knots[Math.min(knots.length - 1, index + 1)]!;
  const dt = next.t - previous.t;
  return dt === 0 ? 0 : (next.depth - previous.depth) / dt;
}

function sampleEdge(
  start: Point,
  end: Point,
  edge: number,
  profile: PieceEdgeProfile | null,
  normalX: number,
  normalY: number,
  tabSize: number,
  samplesPerSegment: number,
): Point[] {
  const segments = createCurvedSegments(start, end, edge, profile, normalX, normalY, tabSize);
  const points: Point[] = [segments[0]!.from];

  for (const segment of segments) {
    for (let index = 1; index <= samplesPerSegment; index += 1) {
      points.push(cubicPoint(segment.from, segment.cp1, segment.cp2, segment.to, index / samplesPerSegment));
    }
  }

  return points;
}

function edgePointFactory(start: Point, end: Point, edge: number, normalX: number, normalY: number, tabSize: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const offset = edge * tabSize;
  return (t: number, depth = 0): Point => ({
    x: start.x + dx * t + normalX * offset * depth,
    y: start.y + dy * t + normalY * offset * depth,
  });
}

function cubicPoint(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt ** 3 * a.x + 3 * mt ** 2 * t * b.x + 3 * mt * t ** 2 * c.x + t ** 3 * d.x,
    y: mt ** 3 * a.y + 3 * mt ** 2 * t * b.y + 3 * mt * t ** 2 * c.y + t ** 3 * d.y,
  };
}

const fallbackProfile: PieceEdgeProfile = {
  center: 0.5,
  neckWidth: 0.18,
  headWidth: 0.38,
  tabDepth: 1,
  waistDepth: 0.15,
  shoulderWidth: 0.62,
  skew: 0,
  reverse: false,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatPoint(point: { x: number; y: number }): string {
  return `${r(point.x)} ${r(point.y)}`;
}

function r(value: number): number {
  return Math.round(value * 100) / 100;
}
