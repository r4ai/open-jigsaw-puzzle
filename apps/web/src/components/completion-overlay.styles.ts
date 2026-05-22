import { css } from "../../styled-system/css";

export const overlay = css({
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  background: "oklch(8% 0.005 80 / 0.55)",
  backdropFilter: "blur(14px) saturate(140%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  animation: "fadeIn 500ms ease-out",
  padding: "16px",
});

export const card = css({
  background: "glass",
  backdropFilter: "blur(24px) saturate(170%)",
  border: "1px solid {colors.glass.border}",
  color: "glass.text",
  boxShadow: "glass",
  padding: "36px 36px 28px",
  textAlign: "center",
  display: "grid",
  gap: "24px",
  justifyItems: "center",
  maxWidth: "420px",
  width: "100%",
  borderRadius: "xl",
  animation: "slideUp 500ms {easings.standard} 200ms both",
});

export const iconCircle = css({
  width: "64px",
  height: "64px",
  borderRadius: "50%",
  background: "color-mix(in oklch, {colors.accent} 15%, transparent)",
  color: "accent",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  animation: "popIn 600ms {easings.standard} 400ms both",
});

export const headingGroup = css({
  display: "grid",
  gap: "6px",
});

export const heading = css({
  margin: 0,
  font: "400 2.5rem/1 {fonts.display}",
  color: "glass.text",
  letterSpacing: "-0.02em",
});

export const subheading = css({
  margin: 0,
  color: "glass.textDim",
  font: "400 0.875rem/1.5 {fonts.ui}",
});

export const statsRow = css({
  display: "flex",
  gap: "10px",
  width: "100%",
});

export const statBox = css({
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
  padding: "16px 12px",
  borderRadius: "md",
  background: "color-mix(in oklch, {colors.glass.text} 5%, transparent)",
  border:
    "1px solid color-mix(in oklch, {colors.glass.text} 10%, transparent)",
});

export const statIcon = css({
  color: "glass.textDim",
  display: "inline-flex",
});

export const statValue = css({
  font: "500 1.5rem/1.1 {fonts.display}",
  color: "glass.text",
  letterSpacing: "-0.01em",
});

export const statLabel = css({
  font: "500 0.625rem/1 {fonts.mono}",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "glass.textDim",
});

export const actions = css({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
  width: "100%",
  marginTop: "4px",
});

export const secondaryBtn = css({
  height: "42px",
  minHeight: "42px",
  background: "color-mix(in oklch, {colors.glass.text} 6%, transparent)",
  border:
    "1px solid color-mix(in oklch, {colors.glass.text} 14%, transparent)",
  color: "glass.text",
  borderRadius: "DEFAULT",
  fontWeight: 500,
  _hover: {
    _enabled: {
      background:
        "color-mix(in oklch, {colors.glass.text} 12%, transparent)",
    },
  },
});

export const primaryBtn = css({
  height: "42px",
  minHeight: "42px",
  fontWeight: 600,
  background: "accent",
  borderColor: "accent",
  color: "#fff",
  borderRadius: "DEFAULT",
  boxShadow: "0 4px 16px color-mix(in oklch, {colors.accent} 40%, transparent)",
  _hover: { _enabled: { background: "accent.dim", borderColor: "accent.dim" } },
});
