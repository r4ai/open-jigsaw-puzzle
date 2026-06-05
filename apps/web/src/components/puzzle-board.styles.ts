import { css } from "../../styled-system/css";

export const boardViewport = css({
  position: "absolute",
  inset: 0,
  backgroundColor: "canvas",
  backgroundImage:
    "radial-gradient(circle, {colors.canvas.dot} 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  cursor: "grab",
  overscrollBehavior: "contain",
  touchAction: "none",
  userSelect: "none",
  overflow: "hidden",
});

export const panning = css({ cursor: "grabbing!" });

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
  border:
    "1.5px dashed color-mix(in oklch, {colors.accent} 65%, transparent)",
  borderRadius: "4px",
  background: "color-mix(in oklch, {colors.accent} 5%, transparent)",
});

export const frameComplete = css({
  borderColor: "color-mix(in oklch, {colors.ok} 65%, transparent)",
  background: "color-mix(in oklch, {colors.ok} 6%, transparent)",
  boxShadow:
    "0 0 0 3px color-mix(in oklch, {colors.ok} 35%, transparent) inset, 0 0 60px color-mix(in oklch, {colors.ok} 12%, transparent)",
});

export const imageOverlay = css({
  position: "absolute",
  cursor: "grab",
  touchAction: "none",
  userSelect: "none",
  borderRadius: "6px",
  boxShadow: "0 4px 20px oklch(0% 0 0 / 0.35)",
  overflow: "hidden",
  zIndex: 1,
  _active: { cursor: "grabbing" },
});

export const overlaySelected = css({
  boxShadow:
    "0 0 0 3px color-mix(in oklch, var(--my-selection-color, {colors.accent}) 70%, transparent), 0 0 0 8px color-mix(in oklch, var(--my-selection-color, {colors.accent}) 18%, transparent)",
});

export const overlayRemoteSelected = css({
  boxShadow:
    "0 0 0 2.5px color-mix(in oklch, var(--remote-selection-color) 65%, transparent), 0 0 0 7px color-mix(in oklch, var(--remote-selection-color) 14%, transparent)",
});

export const overlayLocked = css({
  cursor: "default!",
  _active: { cursor: "default!" },
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
  appearance: "none",
  WebkitAppearance: "none",
  WebkitTapHighlightColor: "transparent",
  background: "transparent",
  overflow: "visible",
  cursor: "grab",
  touchAction: "none",
  transition: "none",
  willChange: "transform",
  "&:hover:not(:disabled)": { background: "transparent" },
  "&:active:not(:disabled)": { background: "transparent" },
  _active: {
    background: "transparent",
    filter: "none",
    transform: "none",
  },
});

export const pieceLocked = css({
  cursor: "default!",
});

export const selectionBox = css({
  position: "absolute",
  zIndex: 999999,
  border: "1px solid {colors.accent}",
  background: "color-mix(in oklch, {colors.accent} 18%, transparent)",
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
    filter: "drop-shadow(0 1px 3px oklch(0% 0 0 / 0.5))",
  },
  "& span": {
    maxWidth: "110px",
    overflow: "hidden",
    borderRadius: "6px",
    padding: "2px 7px",
    background:
      "color-mix(in oklch, var(--cursor-color, {colors.accent}) 18%, {colors.glass})",
    border:
      "1px solid color-mix(in oklch, var(--cursor-color, {colors.accent}) 50%, transparent)",
    color: "canvas.text",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    backdropFilter: "blur(4px)",
  },
});

export const cursorDragging = css({
  transition: "none!",
});

export const imageOverlayToolbar = css({
  position: "absolute",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  gap: "2px",
  background: "glass.strong",
  backdropFilter: "blur(18px) saturate(160%)",
  border: "1px solid {colors.glass.border}",
  borderRadius: "10px",
  padding: "4px 6px",
  transform: "translateX(-50%)",
  pointerEvents: "all",
  whiteSpace: "nowrap",
  boxShadow: "glass",
  color: "glass.text",
  md: {
    gap: "1px",
    padding: "3px 6px",
  },
});

export const toolbarBtn = css({
  width: "44px",
  height: "44px",
  minHeight: "44px",
  padding: 0,
  borderRadius: "7px",
  background: "transparent",
  borderColor: "transparent",
  color: "glass.textDim",
  transition: "background 100ms, color 100ms",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  _hover: {
    _enabled: {
      background:
        "color-mix(in oklch, {colors.glass.text} 10%, transparent)",
      borderColor: "transparent",
      color: "glass.text",
    },
  },
  _active: { _enabled: { transform: "none" } },
  md: {
    width: "28px",
    height: "28px",
    minHeight: "unset",
  },
});

export const toolbarBtnActive = css({
  background: "color-mix(in oklch, {colors.accent} 22%, transparent)",
  color: "accent",
  borderColor: "transparent",
});

export const toolbarDivider = css({
  width: "1px",
  height: "14px",
  margin: "0 3px",
  background: "glass.border",
  flexShrink: 0,
});

export const toolbarOpacityGroup = css({
  display: "flex",
  alignItems: "center",
  gap: "7px",
  minHeight: "44px",
  padding: "0 9px 0 7px",
  md: {
    minHeight: "auto",
    padding: "0 7px 0 5px",
  },
});

export const toolbarLabel = css({
  font: "400 0.68rem/1 {fonts.ui}",
  color: "glass.textDim",
  letterSpacing: "0.01em",
  flexShrink: 0,
});

export const toolbarSlider = css({
  WebkitAppearance: "none",
  appearance: "none",
  width: "132px",
  height: "44px",
  outline: "none",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
  background: "transparent",
  md: {
    width: "88px",
    height: "20px",
  },
  "&::-webkit-slider-runnable-track": {
    height: "3px",
    borderRadius: "2px",
    background:
      "linear-gradient(to right, {colors.accent} var(--slider-pct, 100%), {colors.glass.border} var(--slider-pct, 100%))",
  },
  "&::-webkit-slider-thumb": {
    WebkitAppearance: "none",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "accent",
    border: "2.5px solid {colors.canvas}",
    boxShadow: "0 1px 4px oklch(0% 0 0 / 0.25)",
    cursor: "pointer",
    transition: "transform 100ms",
    marginTop: "-5.5px",
  },
  "&:hover::-webkit-slider-thumb": { transform: "scale(1.1)" },
  "&::-moz-range-track": {
    height: "3px",
    borderRadius: "2px",
    background: "glass.border",
  },
  "&::-moz-range-progress": {
    height: "3px",
    borderRadius: "2px",
    background: "accent",
  },
  "&::-moz-range-thumb": {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "accent",
    border: "2.5px solid {colors.canvas}",
    boxShadow: "0 1px 4px oklch(0% 0 0 / 0.25)",
    cursor: "pointer",
  },
});

export const toolbarVal = css({
  minWidth: "28px",
  textAlign: "right",
  font: "400 0.72rem/1 {fonts.mono}",
  color: "glass.text",
  flexShrink: 0,
});
