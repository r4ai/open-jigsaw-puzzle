import { css } from "../../styled-system/css";

export const root = css({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "22px",
  textAlign: "center",
  padding: "32px",
  pointerEvents: "none",
});

export const dropArea = css({
  pointerEvents: "auto",
});

export const iconWrap = css({
  width: "72px",
  height: "72px",
  borderRadius: "20px",
  background: "color-mix(in oklch, {colors.canvas.text} 5%, transparent)",
  border:
    "1px dashed color-mix(in oklch, {colors.canvas.text} 22%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "canvas.textDim",
});

export const textBlock = css({
  display: "grid",
  gap: "8px",
  padding: "0 20px",
});

export const primaryText = css({
  margin: 0,
  color: "canvas.text",
  font: "500 1rem {fonts.ui}",
});

export const secondaryText = css({
  margin: 0,
  color: "canvas.textDim",
  font: "400 0.75rem {fonts.mono}",
  letterSpacing: "0.04em",
});

export const uploadButton = css({
  pointerEvents: "auto",
  background: "accent",
  borderColor: "accent",
  color: "#fff",
  fontWeight: 600,
  height: "40px",
  fontSize: "0.875rem",
  boxShadow: "0 4px 16px color-mix(in oklch, {colors.accent} 40%, transparent)",
  _hover: {
    _enabled: { background: "accent.dim", borderColor: "accent.dim" },
  },
});

export const loadingIcon = css({
  animation: "spin 0.9s linear infinite",
  color: "canvas.textDim",
});

export const loadingCopy = css({
  display: "grid",
  gap: "8px",
  justifyItems: "center",
  maxWidth: "min(480px, 100%)",
  "& strong": {
    color: "canvas.text",
    fontSize: "0.9375rem",
    fontWeight: 500,
  },
  "& span": {
    color: "canvas.textDim",
    font: "400 0.8125rem/1.55 {fonts.mono}",
  },
});
