import type { PieceEdgeProfile, PieceGeometry } from "@open-puzzle/shared/puzzle";

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
  const headLeft = p.headStart + (p.headEnd - p.headStart) * 0.36;
  const headRight = p.headStart + (p.headEnd - p.headStart) * 0.64;
  const curves = p.reverse
    ? [p.startCurve, 0.04, 0.12, 0, -0.12, -0.05, p.endCurve]
    : [p.startCurve, 0.05, 0.12, 0, -0.12, -0.04, p.endCurve];
  const knots: Array<[number, number, number]> = [
    [p.shoulderStart, 0, curves[0]!],
    [p.headStart, p.shoulderDepth, curves[1]!],
    [p.neckStart, p.neckDepth, curves[2]!],
    [headLeft, p.headDepth, curves[3]!],
    [headRight, p.headDepth, curves[4]!],
    [p.neckEnd, p.neckDepth, curves[5]!],
    [p.headEnd, p.waistDepth, curves[6]!],
    [p.shoulderEnd, 0, 0],
  ];
  const point = edgePointFactory(start, end, edge, normalX, normalY, tabSize);
  const segments: Array<{ from: Point; cp1: Point; cp2: Point; to: Point }> = [];

  for (let index = 0; index < knots.length - 1; index += 1) {
    const [fromT, fromDepth, curve] = knots[index]!;
    const [toT, toDepth] = knots[index + 1]!;
    const span = (toT - fromT) * 0.48;
    segments.push({
      from: point(fromT, fromDepth),
      cp1: point(fromT + span, fromDepth + curve),
      cp2: point(toT - span, toDepth - curve),
      to: point(toT, toDepth),
    });
  }

  return segments;
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
