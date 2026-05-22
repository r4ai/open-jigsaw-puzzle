import { css } from "../../styled-system/css";

export const pieceSvg = css({
  position: "absolute",
  display: "block",
  overflow: "visible",
  pointerEvents: "none",
});

export const pieceShape = css({
  filter: "drop-shadow(0 5px 14px rgba(0, 0, 0, 0.45))",
});

export const pieceShapeLocked = css({
  filter: "none",
});

export const pieceEdge = css({
  fill: "none",
  stroke: "#ffffff",
  strokeOpacity: "var(--piece-edge-opacity-unlocked, 0.65)",
  strokeLinejoin: "round",
  strokeWidth: 1.5,
  vectorEffect: "non-scaling-stroke",
});

export const pieceEdgeLocked = css({
  strokeOpacity: "var(--piece-edge-opacity-locked, 0.18) !important",
});

export const selectionGlow = css({
  fill: "none",
  stroke: "var(--selection-color, {colors.teal})",
  strokeOpacity: "calc(var(--piece-edge-opacity-selected, 0.7) * 0.26)",
  strokeWidth: 9,
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
});

export const selectionStroke = css({
  fill: "none",
  stroke: "var(--selection-color, {colors.teal})",
  strokeOpacity: "var(--piece-edge-opacity-selected, 0.7)",
  strokeWidth: 3,
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
});

export const remoteSelectionGlow = css({
  fill: "none",
  stroke: "var(--remote-color, transparent)",
  strokeOpacity: 0.14,
  strokeWidth: 8,
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
});

export const remoteSelectionStroke = css({
  fill: "none",
  stroke: "var(--remote-color, transparent)",
  strokeOpacity: 0.65,
  strokeWidth: 2.5,
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
});
