import { css } from "../../styled-system/css";

export const backdrop = css({
  position: "fixed",
  inset: 0,
  background: "rgba(10, 8, 4, 0.55)",
  backdropFilter: "blur(4px)",
  zIndex: 100,
  animation: "fadeIn 140ms ease-out",
});

export const positioner = css({
  position: "fixed",
  inset: 0,
  zIndex: 101,
  display: "grid",
  placeItems: "center",
  padding: "12px",
});

export const popup = css({
  width: "min(440px, calc(100vw - 24px))",
  maxHeight: "calc(100dvh - 24px)",
  overflowY: "auto",
  background: "paper.raised",
  color: "ink",
  border: "1px solid {colors.border}",
  borderRadius: "14px",
  boxShadow: "panel",
  display: "flex",
  flexDirection: "column",
  animation: "fadeIn 160ms ease-out",
  "@media (max-width: 480px)": {
    width: "calc(100vw - 16px)",
    maxHeight: "calc(100dvh - 16px)",
    borderRadius: "12px",
  },
});

export const header = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "16px 18px 12px",
  borderBottom: "1px solid {colors.border}",
  "@media (max-width: 480px)": { padding: "14px 14px 10px" },
});

export const title = css({
  margin: 0,
  font: "600 1rem/1.2 {fonts.ui}",
  color: "ink",
});

export const closeBtn = css({
  minHeight: "30px",
  height: "30px",
  width: "30px",
  padding: 0,
  borderRadius: "7px",
  color: "ink.60",
  _hover: { _enabled: { color: "ink" } },
});

export const body = css({
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  padding: "18px",
  "@media (max-width: 480px)": { gap: "14px", padding: "14px" },
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
  color: "ink",
  letterSpacing: "0.01em",
});

export const valueCls = css({
  font: "500 0.75rem/1 {fonts.mono}",
  color: "ink.60",
  minWidth: "3ch",
  textAlign: "right",
});

export const hint = css({
  font: "400 0.75rem/1.4 {fonts.ui}",
  color: "ink.40",
  margin: 0,
});

export const slider = css({
  position: "relative",
  width: "100%",
  height: "32px",
  display: "flex",
  alignItems: "center",
  touchAction: "none",
  userSelect: "none",
});

export const sliderTrack = css({
  position: "relative",
  width: "100%",
  height: "6px",
  borderRadius: "999px",
  background: "paper.sunken",
  border: "1px solid {colors.border}",
});

export const sliderRange = css({
  position: "absolute",
  top: 0,
  left: 0,
  height: "100%",
  borderRadius: "999px",
  background: "teal",
});

export const sliderThumb = css({
  width: "18px",
  height: "18px",
  borderRadius: "50%",
  background: "paper.raised",
  border: "2px solid {colors.teal}",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
  outline: "none",
  cursor: "grab",
  _focusVisible: { boxShadow: "0 0 0 4px {colors.teal.focus}" },
  _active: { cursor: "grabbing" },
});

export const footer = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "12px 18px 16px",
  borderTop: "1px solid {colors.border}",
  "@media (max-width: 480px)": { padding: "10px 14px 14px" },
});

export const resetBtn = css({ minHeight: "34px", height: "34px" });

export const doneBtn = css({
  minHeight: "34px",
  height: "34px",
  background: "teal",
  borderColor: "teal",
  color: "#fff",
  _hover: {
    _enabled: { background: "teal.dark", borderColor: "teal.dark" },
  },
});
