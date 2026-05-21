import { css } from "../../styled-system/css";

const narrowMq = "@media (max-width: 760px), (max-width: 1024px) and (orientation: portrait)";

export const boardViewport = css({
  flex: 1,
  position: "relative",
  width: "100%",
  minHeight: 0,
  border: "1px solid {colors.canvas.rim}",
  borderRadius: "10px",
  overflow: "hidden",
  backgroundColor: "canvas.base",
  backgroundImage:
    "radial-gradient(circle, {colors.canvas.dot} 1px, transparent 1px)",
  backgroundSize: "28px 28px",
  cursor: "grab",
  overscrollBehavior: "contain",
  touchAction: "none",
  userSelect: "none",
  [narrowMq]: { minHeight: 0 },
});

export const panning = css({ cursor: "grabbing !important" });

export const boardStage = css({
  position: "relative",
  width: "100%",
  height: "100%",
  minWidth: "100%",
  minHeight: "100%",
});

export const boardWorld = css({
  position: "absolute",
  inset: 0,
  transformOrigin: "0 0",
  overflow: "visible",
});

export const puzzleFrame = css({
  position: "absolute",
  border: "1px solid {colors.piece.frame}",
  borderRadius: "4px",
  background: "piece.fill",
});

export const frameComplete = css({
  borderColor: "okCanvas.border",
  boxShadow:
    "0 0 0 3px {colors.okCanvas.ring} inset, 0 0 60px {colors.okCanvas.glow}",
});

export const imageOverlay = css({
  position: "absolute",
  cursor: "grab",
  touchAction: "none",
  userSelect: "none",
  borderRadius: "6px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.35)",
  overflow: "hidden",
  zIndex: 1,
  _active: { cursor: "grabbing" },
});

export const overlaySelected = css({
  boxShadow:
    "0 0 0 3px color-mix(in srgb, var(--my-selection-color, {colors.teal}) 70%, transparent), 0 0 0 8px color-mix(in srgb, var(--my-selection-color, {colors.teal}) 18%, transparent)",
});

export const overlayRemoteSelected = css({
  boxShadow:
    "0 0 0 2.5px color-mix(in srgb, var(--remote-selection-color) 65%, transparent), 0 0 0 7px color-mix(in srgb, var(--remote-selection-color) 14%, transparent)",
});

export const overlayLocked = css({
  cursor: "default !important",
  _active: { cursor: "default !important" },
});

export const imageOverlayImg = css({
  display: "block",
  width: "100%",
  height: "100%",
  pointerEvents: "none",
});

export const piece = css({
  position: "absolute",
  top: 0,
  left: 0,
  minHeight: 0,
  padding: 0,
  border: 0,
  background: "transparent",
  overflow: "visible",
  cursor: "grab",
  touchAction: "none",
  transition: "none",
  willChange: "transform",
  "&:hover:not(:disabled)": { background: "transparent" },
  "&:active:not(:disabled)": { background: "transparent" },
});

export const pieceLocked = css({
  cursor: "default !important",
});

export const selectionBox = css({
  position: "absolute",
  zIndex: 999999,
  border: "1px solid {colors.teal}",
  background: "color-mix(in srgb, {colors.teal} 18%, transparent)",
  pointerEvents: "none",
});

export const remoteCursor = css({
  position: "absolute",
  top: 0,
  left: 0,
  zIndex: 1000000,
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  color: "var(--cursor-color, {colors.accent})",
  font: "500 0.72rem {fonts.ui}",
  pointerEvents: "none",
  transform:
    "translate3d(var(--cursor-x, 0), var(--cursor-y, 0), 0) translate(2px, 2px)",
  transition: "transform 80ms linear",
  willChange: "transform",
  "& svg": {
    fill: "var(--cursor-color, {colors.accent})",
    filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5))",
  },
  "& span": {
    maxWidth: "110px",
    overflow: "hidden",
    borderRadius: "6px",
    padding: "2px 7px",
    background:
      "color-mix(in srgb, var(--cursor-color, {colors.accent}) 18%, {colors.canvas.glass.base})",
    border:
      "1px solid color-mix(in srgb, var(--cursor-color, {colors.accent}) 50%, transparent)",
    color: "onCanvas",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    backdropFilter: "blur(4px)",
  },
});

export const cursorDragging = css({
  transition: "none !important",
});

export const imageOverlayToolbar = css({
  position: "absolute",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  gap: "1px",
  background: "canvas.glass.base",
  backdropFilter: "blur(12px)",
  border: "1px solid {colors.canvas.glass.border}",
  borderRadius: "10px",
  padding: "3px 6px",
  transform: "translateX(-50%)",
  pointerEvents: "all",
  whiteSpace: "nowrap",
  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.14), 0 1px 3px rgba(0, 0, 0, 0.1)",
});

export const toolbarBtn = css({
  width: "28px",
  height: "28px",
  minHeight: "unset",
  padding: 0,
  borderRadius: "7px",
  background: "transparent",
  borderColor: "transparent",
  color: "onCanvas.mid",
  transition: "background 100ms, color 100ms",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  _hover: {
    _enabled: {
      background: "canvas.glass.hover",
      borderColor: "transparent",
      color: "onCanvas",
    },
  },
  _active: { _enabled: { transform: "none" } },
});

export const toolbarBtnActive = css({
  background: "color-mix(in srgb, {colors.teal} 15%, transparent)",
  color: "teal",
  borderColor: "transparent",
  _hover: {
    _enabled: {
      background: "color-mix(in srgb, {colors.teal} 24%, transparent)",
      borderColor: "transparent",
      color: "teal",
    },
  },
});

export const toolbarDivider = css({
  width: "1px",
  height: "14px",
  margin: "0 3px",
  background: "canvas.glass.border",
  flexShrink: 0,
});

export const toolbarOpacityGroup = css({
  display: "flex",
  alignItems: "center",
  gap: "7px",
  padding: "0 7px 0 5px",
});

export const toolbarLabel = css({
  font: "400 0.68rem/1 {fonts.ui}",
  color: "onCanvas.dim",
  letterSpacing: "0.01em",
  flexShrink: 0,
});

export const toolbarSlider = css({
  WebkitAppearance: "none",
  appearance: "none",
  width: "88px",
  height: "20px",
  outline: "none",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
  background: "transparent",
  "&::-webkit-slider-runnable-track": {
    height: "3px",
    borderRadius: "2px",
    background:
      "linear-gradient(to right, {colors.teal} var(--slider-pct, 100%), {colors.canvas.glass.border} var(--slider-pct, 100%))",
  },
  "&::-webkit-slider-thumb": {
    WebkitAppearance: "none",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "teal",
    border: "2.5px solid {colors.canvas.base}",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
    cursor: "pointer",
    transition: "transform 100ms",
    marginTop: "-5.5px",
  },
  "&:hover::-webkit-slider-thumb": { transform: "scale(1.1)" },
  "&::-moz-range-track": {
    height: "3px",
    borderRadius: "2px",
    background: "canvas.glass.border",
  },
  "&::-moz-range-progress": {
    height: "3px",
    borderRadius: "2px",
    background: "teal",
  },
  "&::-moz-range-thumb": {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "teal",
    border: "2.5px solid {colors.canvas.base}",
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.25)",
    cursor: "pointer",
  },
});

export const toolbarVal = css({
  minWidth: "28px",
  textAlign: "right",
  font: "400 0.72rem/1 {fonts.mono}",
  color: "onCanvas.mid",
  flexShrink: 0,
});

export const zoomControls = css({
  position: "absolute",
  bottom: "12px",
  right: "12px",
  display: "flex",
  alignItems: "center",
  gap: "2px",
  background: "canvas.glass.base",
  backdropFilter: "blur(10px)",
  border: "1px solid {colors.canvas.glass.border}",
  borderRadius: "9px",
  padding: "3px",
  zIndex: 50,
  "& button": {
    width: "28px",
    height: "28px",
    minHeight: "unset",
    padding: 0,
    borderRadius: "6px",
    background: "transparent",
    borderColor: "transparent",
    color: "onCanvas.mid",
    fontSize: "0.8125rem",
    transition: "background 100ms, color 100ms",
  },
  "& button:hover:not(:disabled)": {
    background: "canvas.glass.hover",
    borderColor: "transparent",
    color: "onCanvas",
  },
  "& button:disabled": { opacity: 0.25 },
  "& button:active:not(:disabled)": { transform: "none" },
  [narrowMq]: { bottom: "8px", right: "8px" },
});

export const zoomPct = css({
  minWidth: "42px",
  textAlign: "center",
  font: "400 0.75rem/1 {fonts.mono}",
  color: "onCanvas.dim",
});

export const canvasStatus = css({
  position: "absolute",
  bottom: "12px",
  left: "12px",
  maxWidth: "calc(100% - 160px)",
  padding: "5px 10px",
  background: "canvas.glass.base",
  backdropFilter: "blur(10px)",
  border: "1px solid {colors.canvas.glass.border}",
  borderRadius: "7px",
  color: "onCanvas.dim",
  font: "400 0.72rem/1.45 {fonts.mono}",
  zIndex: 50,
  pointerEvents: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  [narrowMq]: {
    bottom: "52px",
    left: "8px",
    maxWidth: "calc(100% - 16px)",
  },
});

export const canvasStatusComplete = css({
  borderColor: "okCanvas.ring",
  background: "okCanvas.glass",
  color: "okCanvas.text",
});
