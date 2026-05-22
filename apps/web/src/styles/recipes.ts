import { css, cva } from "../../styled-system/css";

/** Frosted-glass surface, used by floating overlay panels. */
export const glassPanel = cva({
  base: {
    background: "glass",
    backdropFilter: "blur(24px) saturate(170%)",
    border: "1px solid {colors.glass.border}",
    borderRadius: "lg",
    boxShadow: "glass",
    color: "glass.text",
  },
  variants: {
    tone: {
      panel: {},
      strong: { background: "glass.strong" },
    },
  },
  defaultVariants: { tone: "panel" },
});

/** Square icon button used inside glass overlays. */
export const glassIconButton = cva({
  base: {
    width: "36px",
    height: "36px",
    minHeight: "36px",
    padding: 0,
    background: "transparent",
    border: "1px solid transparent",
    color: "glass.text",
    borderRadius: "DEFAULT",
    opacity: 0.85,
    transition: "background 120ms, opacity 120ms, color 120ms, transform 80ms",
    _hover: {
      _enabled: {
        background: "color-mix(in oklch, {colors.glass.text} 10%, transparent)",
        borderColor:
          "color-mix(in oklch, {colors.glass.text} 12%, transparent)",
        opacity: 1,
      },
    },
    _disabled: { opacity: 0.4 },
  },
  variants: {
    active: {
      true: {
        background:
          "color-mix(in oklch, {colors.glass.text} 12%, transparent)",
      },
      false: {},
    },
  },
  defaultVariants: { active: false },
});

/** Animation helper for floating panel entry. */
export const fadeUpIn = (delayMs = 0) =>
  css({
    animation: `fadeUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms both`,
  });

/** Small stat chip used inside the top-left brand panel. */
export const statChip = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  height: "24px",
  border:
    "1px solid color-mix(in oklch, {colors.glass.text} 14%, transparent)",
  borderRadius: "sm",
  padding: "0 8px",
  background: "color-mix(in oklch, {colors.glass.text} 5%, transparent)",
  color: "color-mix(in oklch, {colors.glass.text} 78%, transparent)",
  font: "400 0.72rem/1 {fonts.mono}",
  whiteSpace: "nowrap",
});
