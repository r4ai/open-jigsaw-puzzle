import { css } from "../../styled-system/css";

export const backdrop = css({
  position: "fixed",
  inset: 0,
  background: "oklch(8% 0.005 80 / 0.5)",
  backdropFilter: "blur(8px) saturate(140%)",
  zIndex: 200,
  animation: "fadeIn 160ms ease-out",
});

export const positioner = css({
  position: "fixed",
  inset: 0,
  zIndex: 201,
  display: "grid",
  placeItems: "center",
  padding: "12px",
});

export const popup = css({
  width: "min(460px, calc(100vw - 24px))",
  maxHeight: "calc(100dvh - 24px)",
  overflowY: "auto",
  overflowX: "hidden",
  background: "surface.2",
  color: "text.1",
  border: "1px solid {colors.border}",
  borderRadius: "lg",
  boxShadow: "panel",
  display: "flex",
  flexDirection: "column",
  animation: "slideUp 220ms {easings.standard}",
});

export const header = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "18px 20px 14px",
  borderBottom: "1px solid {colors.border}",
});

export const headerTitle = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
});

export const headerIcon = css({
  color: "accent",
  display: "inline-flex",
});

export const title = css({
  margin: 0,
  font: "600 1.0625rem/1.2 {fonts.ui}",
  color: "text.1",
});

export const closeBtn = css({
  width: "32px",
  height: "32px",
  minHeight: "unset",
  padding: 0,
  borderRadius: "sm",
  color: "text.3",
});

export const body = css({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  padding: "20px",
});

export const sectionGroup = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
});

export const sectionGroupSliders = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

export const sectionLabel = css({
  margin: 0,
  font: "500 0.625rem/1 {fonts.mono}",
  letterSpacing: "0.13em",
  textTransform: "uppercase",
  color: "text.3",
});

export const section = css({
  display: "flex",
  flexDirection: "column",
  gap: "6px",
});

export const sectionHeader = css({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "12px",
});

export const labelCls = css({
  font: "600 0.8125rem/1.3 {fonts.ui}",
  color: "text.1",
  letterSpacing: "0.01em",
});

export const valueCls = css({
  font: "500 0.75rem/1 {fonts.mono}",
  color: "text.3",
  minWidth: "3ch",
  textAlign: "right",
});

export const hint = css({
  font: "400 0.75rem/1.5 {fonts.ui}",
  color: "text.3",
  margin: 0,
});

export const slider = css({
  position: "relative",
  width: "100%",
  height: "32px",
  display: "flex",
  alignItems: "center",
  paddingInline: "9px",
  touchAction: "none",
  userSelect: "none",
});

export const sliderTrack = css({
  position: "relative",
  width: "100%",
  height: "5px",
  borderRadius: "999px",
  background: "surface.3",
  border: "1px solid {colors.border}",
  overflow: "hidden",
});

export const sliderRange = css({
  position: "absolute",
  top: 0,
  left: 0,
  height: "100%",
  borderRadius: "999px",
  background: "accent",
});

export const sliderThumb = css({
  width: "18px",
  height: "18px",
  borderRadius: "50%",
  background: "surface.2",
  border: "2px solid {colors.accent}",
  boxShadow: "sm",
  outline: "none",
  cursor: "grab",
  _focusVisible: { boxShadow: "0 0 0 4px {colors.accent.focus}" },
  _active: { cursor: "grabbing" },
});

export const footer = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "12px 20px 16px",
  borderTop: "1px solid {colors.border}",
});

export const resetBtn = css({
  height: "36px",
  minHeight: "36px",
  fontSize: "0.8125rem",
});

export const doneBtn = css({
  height: "36px",
  minHeight: "36px",
  fontWeight: 600,
  background: "accent",
  borderColor: "accent",
  color: "#fff",
  minWidth: "88px",
  _hover: { _enabled: { background: "accent.dim", borderColor: "accent.dim" } },
});

export const userNameLabel = css({
  display: "grid",
  gap: "6px",
  font: "600 0.8125rem {fonts.ui}",
  color: "text.2",
  letterSpacing: "0.01em",
});
