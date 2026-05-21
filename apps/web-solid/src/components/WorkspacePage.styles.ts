import { css } from "../../styled-system/css";

const narrowMq = "@media (max-width: 760px), (max-width: 1024px) and (orientation: portrait)";

export const workspace = css({
  height: "100dvh",
  width: "100%",
  maxWidth: "100vw",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 192px",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: "10px 12px",
  padding: "12px",
  overflow: "hidden",
  [narrowMq]: {
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "auto auto minmax(0, 1fr)",
    padding: "10px",
    gap: "8px",
  },
});

export const sidebarCollapsed = css({
  gridTemplateColumns: "minmax(0, 1fr) !important",
});

export const boardWrap = css({
  gridColumn: 1,
  gridRow: 2,
  position: "relative",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  [narrowMq]: { gridColumn: 1, gridRow: 3 },
});

export const toast = css({
  position: "fixed",
  left: "50%",
  bottom: "20px",
  transform: "translateX(-50%)",
  zIndex: 9999,
  border: "1px solid {colors.err.border}",
  borderRadius: "10px",
  padding: "11px 18px",
  background: "err.surf",
  color: "err",
  font: "500 0.875rem {fonts.ui}",
  boxShadow: "0 8px 24px {colors.err.shadow}",
  maxWidth: "min(480px, calc(100vw - 32px))",
  whiteSpace: "pre-wrap",
});
