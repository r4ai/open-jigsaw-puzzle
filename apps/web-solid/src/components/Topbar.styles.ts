import { css } from "../../styled-system/css";

const narrowMq = "@media (max-width: 760px), (max-width: 1024px) and (orientation: portrait)";

export const topbar = css({
  gridColumn: "1 / -1",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "paper.raised",
  border: "1px solid {colors.border}",
  borderRadius: "10px",
  padding: "0 14px",
  height: "50px",
  flexShrink: 0,
  [narrowMq]: {
    height: "auto",
    padding: "10px 12px",
    flexWrap: "wrap",
    gap: "8px",
  },
});

export const topbarLeft = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexShrink: 0,
  [narrowMq]: { flexShrink: 1, minWidth: 0 },
});

export const brandMark = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "30px",
  height: "30px",
  borderRadius: "7px",
  background: "teal",
  color: "#fff",
  font: "700 0.625rem/1 {fonts.mono}",
  letterSpacing: "0.04em",
  flexShrink: 0,
});

export const roomInfo = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  lineHeight: 1,
  [narrowMq]: { minWidth: 0 },
});

export const roomIdLabel = css({
  font: "500 0.6rem/1 {fonts.mono}",
  letterSpacing: "0.14em",
  color: "ink.40",
  textTransform: "uppercase",
});

export const roomId = css({
  font: "600 0.9375rem/1 {fonts.mono}",
  color: "ink",
  letterSpacing: "0.05em",
  [narrowMq]: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "120px",
  },
});

export const topbarSep = css({
  width: "1px",
  height: "22px",
  background: "border",
  flexShrink: 0,
  [narrowMq]: { display: "none" },
});

export const topbarStats = css({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  [narrowMq]: { flexWrap: "wrap", flexShrink: 1, minWidth: 0 },
});

export const statChip = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  height: "24px",
  border: "1px solid {colors.border}",
  borderRadius: "6px",
  padding: "0 8px",
  background: "paper.sunken",
  color: "ink.60",
  font: "400 0.75rem/1 {fonts.mono}",
});

export const topbarSpacer = css({ flex: 1 });

export const topActions = css({
  display: "flex",
  alignItems: "center",
  gap: "6px",
  "& button": {
    fontSize: "0.8125rem",
    fontWeight: 500,
    minHeight: "32px",
    height: "32px",
    padding: "0 11px",
    gap: "5px",
  },
  [narrowMq]: {
    width: "100%",
    flexWrap: "wrap",
    "& button": { flex: 1, minWidth: 0, justifyContent: "center" },
  },
});

export const themeToggle = css({
  width: "32px",
  padding: 0,
  color: "ink.60",
  _hover: { _enabled: { color: "ink" } },
  [narrowMq]: { flex: "0 0 auto !important", width: "38px" },
});

export const sidebarToggle = css({
  [narrowMq]: { display: "none" },
});

export const shareText = css({
  [narrowMq]: { display: "none" },
});
