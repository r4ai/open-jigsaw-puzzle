import { css } from "../../styled-system/css";

export const home = css({
  display: "flex",
  flexDirection: "column",
  minHeight: "100dvh",
  lg: {
    display: "grid",
    gridTemplateColumns: "1fr 420px",
  },
});

export const hero = css({
  background: "hero.bg",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  padding: "2.25rem",
  flex: 1,
  minHeight: "380px",
  position: "relative",
  overflow: "hidden",
  lg: {
    justifyContent: "center",
    padding: "6rem",
    flex: "initial",
    minHeight: "initial",
  },
});

export const deco = css({
  position: "absolute",
  top: "50%",
  right: "min(6rem, 10%)",
  height: "78%",
  maxWidth: "60%",
  transform: "translateY(-50%)",
  color: "hero.deco",
  pointerEvents: "none",
  "& path": {
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinejoin: "round",
    fill: "none",
  },
});

const decoPieceBase = {
  transformBox: "fill-box" as const,
  transformOrigin: "center",
  opacity: 0,
};

export const pieceA = css({
  ...decoPieceBase,
  animation: "pieceFall 1.1s {easings.standard} 0.3s both",
});

export const pieceB = css({
  ...decoPieceBase,
  animation: "pieceSlideLeft 1.1s {easings.standard} 0.85s both",
});

export const pieceC = css({
  ...decoPieceBase,
  animation: "pieceSlideUp 1.3s {easings.standard} 1.4s both",
});

export const heroContent = css({
  position: "relative",
  zIndex: 1,
  display: "grid",
  gap: "2.5rem",
  animation: "fadeUp 0.7s {easings.standard} both",
  paddingTop: "1.25rem",
  lg: { paddingTop: 0 },
});

export const heading = css({
  margin: 0,
  font: "400 clamp(2.75rem, 13vw, 5rem)/0.93 {fonts.display}",
  letterSpacing: "-0.035em",
  color: "hero.text",
  textWrap: "balance",
  "& em": {
    fontStyle: "italic",
    color: "hero.deco",
  },
  lg: { fontSize: "7.5rem" },
});

export const tagline = css({
  margin: 0,
  color: "hero.textDim",
  fontSize: "clamp(0.95rem, 3.5vw, 1.2rem)",
  lineHeight: 1.75,
  lg: { fontSize: "1.35rem" },
});

export const panelWrap = css({
  background: "surface.1",
  borderLeft: "none",
  borderTop: "1px solid {colors.border}",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "36px 24px 48px",
  position: "relative",
  lg: {
    borderLeft: "1px solid {colors.border}",
    borderTop: "none",
    alignItems: "center",
    padding: "64px 44px",
  },
});

export const themeToggle = css({
  position: "absolute",
  top: "20px",
  right: "20px",
  width: "36px",
  height: "36px",
  minHeight: "unset!",
  padding: 0,
  borderRadius: "DEFAULT",
  color: "text.3",
});

export const panelInner = css({
  width: "100%",
  maxWidth: "100%",
  display: "grid",
  gap: "18px",
  animation: "fadeUp 0.7s {easings.standard} 0.1s both",
  lg: { maxWidth: "360px" },
});

export const panelHeader = css({
  margin: 0,
  font: "500 0.6875rem/1 {fonts.mono}",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "text.3",
  paddingBottom: "14px",
  borderBottom: "1px solid {colors.border}",
});

export const fieldGroup = css({
  display: "grid",
  gap: "10px",
});

export const fieldLabel = css({
  margin: 0,
  font: "600 0.8125rem {fonts.ui}",
  color: "text.2",
  letterSpacing: "0.01em",
});

export const difficultyGroup = css({
  display: "grid",
  gap: "6px",
});

export const groupLabel = css({
  margin: 0,
  font: "500 0.6875rem/1 {fonts.mono}",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "text.3",
});

export const difficulty = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "7px",
  "& button": {
    font: "500 0.875rem/1 {fonts.mono}",
    padding: "0 6px",
    borderRadius: "DEFAULT",
    minHeight: "44px",
    minWidth: 0,
    borderColor: "border",
    background: "transparent",
    color: "text.2",
    transition: "background 120ms, border-color 120ms, color 120ms",
  },
  "& button:not([aria-pressed='true']):hover:not(:disabled)": {
    borderColor: "accent.border",
    background: "accent.surface",
    color: "accent",
  },
});

export const difficultyAdvanced = css({
  gridTemplateColumns: "repeat(auto-fit, minmax(62px, 1fr))",
});

export const selected = css({
  borderColor: "accent!",
  background: "accent!",
  color: "#fff!",
});

export const advancedNote = css({
  margin: "2px 0 0",
  font: "400 0.73rem/1.4 {fonts.ui}",
  color: "text.3",
});

export const primary = css({
  borderColor: "accent",
  background: "accent",
  color: "#fff",
  fontWeight: 600,
  minHeight: "46px",
  borderRadius: "md",
  fontSize: "0.9375rem",
  _hover: { _enabled: { background: "accent.dim", borderColor: "accent.dim" } },
});

export const divider = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  color: "text.3",
  fontSize: "0.8125rem",
  _before: { content: '""', flex: 1, height: "1px", background: "border" },
  _after: { content: '""', flex: 1, height: "1px", background: "border" },
});

export const joinRow = css({
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "8px",
  "& input": {
    fontFamily: "mono",
    fontSize: "0.9375rem",
    letterSpacing: "0.06em",
  },
  "& button": { fontWeight: 600 },
});

export const error = css({
  color: "err",
  margin: 0,
  font: "500 0.875rem {fonts.ui}",
});
