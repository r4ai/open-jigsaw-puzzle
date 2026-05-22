import { css } from "../../styled-system/css";

export const home = css({
  display: "grid",
  gridTemplateColumns: "1fr 420px",
  minHeight: "100dvh",
  "@media (max-width: 960px)": {
    display: "flex",
    flexDirection: "column",
    minHeight: "100dvh",
  },
});

export const hero = css({
  background: "canvas.base",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "6rem",
  position: "relative",
  "@media (max-width: 960px)": {
    justifyContent: "flex-start",
    padding: "2rem",
    flex: 1,
    minHeight: "400px",
  },
});

export const deco = css({
  position: "absolute",
  top: "50%",
  right: "min(6rem, 10%)",
  height: "80%",
  maxWidth: "80%",
  transform: "translateY(-50%)",
  color: "decoTeal",
  pointerEvents: "none",
  "& path": {
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinejoin: "round",
    fill: "none",
  },
  "@media (max-width: 960px)": {
    top: "50%",
    right: "2rem",
    transform: "translateY(-50%)",
    height: "80%",
    maxWidth: "60%",
  },
});

const decoPieceBase = {
  transformBox: "fill-box",
  transformOrigin: "center",
  opacity: 0,
};

export const pieceA = css({
  ...decoPieceBase,
  animation: "pieceFall 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards",
});

export const pieceB = css({
  ...decoPieceBase,
  animation: "pieceSlideLeft 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.9s forwards",
});

export const pieceC = css({
  ...decoPieceBase,
  animation: "pieceSlideUp 1.3s cubic-bezier(0.16, 1, 0.3, 1) 1.5s forwards",
});

export const heroContent = css({
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  display: "grid",
  gap: "3rem",
});

export const heading = css({
  margin: 0,
  font: "400 7.5rem/0.93 {fonts.display}",
  letterSpacing: "-0.035em",
  color: "onCanvas",
  "& em": {
    fontStyle: "italic",
    color: "decoTeal",
  },
  "@media (max-width: 960px)": { fontSize: "clamp(2.75rem, 13vw, 5rem)" },
});

export const tagline = css({
  margin: 0,
  color: "onCanvas.mid",
  fontSize: "1.4rem",
  lineHeight: 1.75,
  "@media (max-width: 960px)": {
    fontSize: "clamp(1rem, 4vw, 1.25rem)",
    lineHeight: 1.6,
  },
});

export const panelWrap = css({
  background: "paper",
  borderLeft: "1px solid {colors.border}",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "64px 44px",
  position: "relative",
  "@media (max-width: 960px)": {
    borderLeft: "none",
    borderTop: "1px solid {colors.border}",
    alignItems: "flex-start",
    padding: "40px 28px 52px",
  },
});

export const themeToggle = css({
  position: "absolute",
  top: "20px",
  right: "20px",
  width: "36px",
  height: "36px",
  minHeight: "unset !important",
  padding: 0,
  borderRadius: "8px",
  borderColor: "border",
  background: "paper.raised",
  color: "ink.60",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
  _hover: {
    _enabled: {
      color: "ink",
      borderColor: "border.strong",
      background: "paper.sunken",
    },
  },
});

export const panelInner = css({
  width: "100%",
  maxWidth: "360px",
  display: "grid",
  gap: "18px",
  animation: "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
  "@media (max-width: 960px)": { maxWidth: "100%" },
});

export const panelHeader = css({
  margin: 0,
  font: "500 0.6875rem/1 {fonts.mono}",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "ink.40",
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
  color: "ink.60",
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
  color: "ink.40",
});

export const difficulty = css({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "8px",
  "& button": {
    font: "500 0.875rem/1 {fonts.mono}",
    padding: "0 6px",
    borderRadius: "8px",
    minHeight: "44px",
    minWidth: 0,
  },
  "& button:not(.selected):hover:not(:disabled)": {
    borderColor: "teal.border",
    background: "teal.surf",
    color: "teal",
  },
});

export const difficultyAdvanced = css({
  gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
});

export const selected = css({
  borderColor: "teal !important",
  background: "teal !important",
  color: "#fff !important",
});

export const advancedNote = css({
  margin: "2px 0 0",
  font: "400 0.75rem/1.4 {fonts.ui}",
  color: "ink.40",
});

export const primary = css({
  borderColor: "teal",
  background: "teal",
  color: "#fff",
  fontWeight: 600,
  minHeight: "46px",
  borderRadius: "10px",
  fontSize: "0.9375rem",
  _hover: {
    _enabled: { background: "teal.dark", borderColor: "teal.dark" },
  },
});

export const divider = css({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  color: "ink.40",
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
