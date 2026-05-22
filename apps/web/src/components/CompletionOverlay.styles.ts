import { css } from "../../styled-system/css";

export const completionOverlay = css({
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background: "rgba(15, 12, 8, 0.72)",
  backdropFilter: "blur(8px)",
  animation: "completionFadeIn 400ms cubic-bezier(0.16, 1, 0.3, 1) both",
});

export const completionCard = css({
  display: "grid",
  gap: "20px",
  padding: "40px 44px",
  border: "1px solid {colors.border}",
  borderRadius: "20px",
  background: "paper.raised",
  boxShadow:
    "0 1px 0 {colors.panelInset} inset, {shadows.panel}, 0 0 0 1px rgba(255,255,255,0.04)",
  maxWidth: "420px",
  width: "100%",
  textAlign: "center",
  animation: "completionCardIn 500ms cubic-bezier(0.16, 1, 0.3, 1) both",
});

export const completionEyebrow = css({
  margin: 0,
  font: "500 0.6875rem/1 {fonts.mono}",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "ok",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  _before: {
    content: '""',
    display: "block",
    width: "22px",
    height: "2px",
    background: "ok",
    borderRadius: "1px",
  },
  _after: {
    content: '""',
    display: "block",
    width: "22px",
    height: "2px",
    background: "ok",
    borderRadius: "1px",
  },
});

export const completionTitle = css({
  margin: 0,
  font: "400 clamp(2.2rem, 6vw, 3.2rem)/1.1 {fonts.display}",
  letterSpacing: "-0.02em",
  color: "ink",
  "& em": {
    fontStyle: "italic",
    color: "teal",
  },
});

export const completionDesc = css({
  margin: 0,
  color: "ink.60",
  fontSize: "0.9375rem",
  lineHeight: 1.6,
});

export const completionTime = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
  padding: "14px 16px",
  border: "1px solid {colors.border}",
  borderRadius: "12px",
  background: "panelInset",
});

export const completionTimeLabel = css({
  font: "500 0.6875rem/1 {fonts.mono}",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "ink.60",
});

export const completionTimeValue = css({
  font: "500 1.75rem/1 {fonts.mono}",
  letterSpacing: "0.04em",
  color: "ink",
  fontVariantNumeric: "tabular-nums",
});

export const completionActions = css({
  display: "grid",
  gap: "10px",
  marginTop: "4px",
});

export const completionBtn = css({
  minHeight: "46px",
  borderRadius: "10px",
  fontSize: "0.9375rem",
  fontWeight: 600,
  width: "100%",
  justifyContent: "center",
});

export const primary = css({
  borderColor: "teal",
  background: "teal",
  color: "#fff",
  _hover: {
    _enabled: {
      background: "teal.dark",
      borderColor: "teal.dark",
    },
  },
});
