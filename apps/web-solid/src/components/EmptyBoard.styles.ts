import { css } from "../../styled-system/css";

export const emptyBoard = css({
  flex: 1,
  border: "1.5px dashed {colors.canvas.rim}",
  borderRadius: "10px",
  display: "grid",
  placeItems: "center",
  alignContent: "center",
  gap: "14px",
  color: "onCanvas.fade",
  background: "canvas.base",
  textAlign: "center",
  padding: "32px",
  minHeight: 0,
});

export const dropTarget = css({
  borderColor: "drop.border",
  background:
    "radial-gradient(circle, {colors.drop.dot} 1px, transparent 1px), {colors.canvas.base}",
  backgroundSize: "24px 24px",
});

export const emptyUploadButton = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minWidth: "176px",
  minHeight: "44px",
  borderColor: "teal",
  background: "teal",
  color: "#fff",
  fontWeight: 600,
  borderRadius: "10px",
  fontSize: "0.9375rem",
  _hover: {
    _enabled: { background: "teal.dark", borderColor: "teal.dark" },
  },
});

export const emptyHint = css({
  font: "400 0.8125rem {fonts.ui}",
  color: "onCanvas.ghost",
});

export const emptySub = css({
  font: "400 0.75rem/1.5 {fonts.mono}",
  color: "onCanvas.ghost",
  maxWidth: "400px",
});

export const loadingIcon = css({
  animation: "spin 0.9s linear infinite",
  color: "teal.border",
});

export const loadingCopy = css({
  display: "grid",
  gap: "8px",
  justifyItems: "center",
  maxWidth: "min(480px, 100%)",
  "& strong": {
    color: "onCanvas.strong",
    fontSize: "0.9375rem",
    fontWeight: 500,
  },
  "& span": {
    color: "onCanvas.sub",
    font: "400 0.8125rem/1.55 {fonts.mono}",
  },
});
