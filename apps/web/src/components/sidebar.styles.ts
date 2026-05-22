import { css } from "../../styled-system/css";

const narrowMq = "@media (max-width: 760px), (max-width: 1024px) and (orientation: portrait)";

export const people = css({
  gridColumn: 2,
  gridRow: 2,
  display: "grid",
  alignContent: "start",
  gap: "6px",
  overflowY: "auto",
  [narrowMq]: {
    gridColumn: 1,
    gridRow: 2,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
    maxHeight: "30dvh",
    alignContent: "unset",
  },
});

export const memberList = css({
  display: "contents",
  [narrowMq]: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: "6px",
    minWidth: 0,
  },
});

export const hidden = css({
  display: "none",
  [narrowMq]: { display: "flex" },
});

export const nameEditorWrap = css({
  display: "grid",
  gap: "6px",
});

export const nameEditorLabel = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  font: "500 0.625rem/1 {fonts.mono}",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "ink.40",
  _after: {
    content: '""',
    flex: 1,
    height: "1px",
    background: "border",
  },
});

export const nameEditor = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 32px",
  gap: "6px",
  "& input": {
    minWidth: 0,
    minHeight: "unset",
    height: "32px",
    borderRadius: "7px",
    padding: "0 9px",
    fontSize: "0.8125rem",
  },
  "& button": {
    width: "32px",
    height: "32px",
    minHeight: "32px",
    padding: 0,
    borderRadius: "7px",
    justifyContent: "center",
  },
  [narrowMq]: { gridTemplateColumns: "minmax(0, 1fr) 36px" },
});

export const peopleSubheader = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  margin: "4px 0 0",
  font: "500 0.625rem/1 {fonts.mono}",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "ink.40",
  _after: {
    content: '""',
    flex: 1,
    height: "1px",
    background: "border",
  },
  [narrowMq]: { margin: 0, flexBasis: "100%" },
});

export const person = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minHeight: "40px",
  border: "1px solid {colors.border}",
  borderRadius: "10px",
  padding: "0 10px",
  background: "paper.raised",
  "& span": {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "0.875rem",
  },
  [narrowMq]: {
    flex: "0 1 auto",
    minWidth: 0,
    maxWidth: "100%",
    minHeight: "32px",
    padding: "0 8px",
    gap: "6px",
    "& span": { maxWidth: "140px", fontSize: "0.8125rem" },
  },
});

export const personAvatar = css({
  width: "24px",
  height: "24px",
  borderRadius: "6px",
  background:
    "color-mix(in srgb, var(--participant-color, {colors.teal}) 16%, {colors.paper.raised})",
  border:
    "1px solid color-mix(in srgb, var(--participant-color, {colors.teal}) 52%, {colors.border})",
  color: "var(--participant-color, {colors.teal})",
  font: "600 0.72rem/1 {fonts.ui}",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textTransform: "uppercase",
  flexShrink: 0,
  [narrowMq]: { width: "20px", height: "20px", fontSize: "0.68rem" },
});

export const hostBadge = css({
  font: "500 0.625rem/1 {fonts.mono}",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "accent",
  background: "accent.surf",
  border: "1px solid {colors.accent.border}",
  borderRadius: "4px",
  padding: "2px 5px",
  flexShrink: 0,
});
