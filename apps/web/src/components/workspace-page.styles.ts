import { css } from "../../styled-system/css";

export const workspace = css({
  position: "fixed",
  inset: 0,
  overflow: "hidden",
  background: "canvas",
});

export const toast = css({
  position: "absolute",
  left: "50%",
  bottom: "76px",
  transform: "translateX(-50%)",
  zIndex: 60,
  display: "flex",
  alignItems: "center",
  gap: "10px",
  border: "1px solid {colors.err.border}",
  borderRadius: "DEFAULT",
  padding: "10px 16px",
  background: "err.surface",
  color: "err",
  font: "500 0.8125rem {fonts.ui}",
  boxShadow: "0 8px 24px color-mix(in oklch, {colors.err} 12%, transparent)",
  maxWidth: "min(440px, calc(100vw - 32px))",
  animation: "slideUp 220ms {easings.standard}",
});
