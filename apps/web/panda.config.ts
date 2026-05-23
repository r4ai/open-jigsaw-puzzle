import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  preflight: true,
  include: ["./src/**/*.{ts,tsx}"],
  exclude: [],
  jsxFramework: "solid",
  outdir: "styled-system",

  conditions: {
    light: '[data-theme="light"] &',
    dark: '[data-theme="dark"] &',
  },

  theme: {
    breakpoints: {
      sm: "481px",
      md: "761px",
      lg: "961px",
      xl: "1025px",
    },

    keyframes: {
      spin: { to: { transform: "rotate(360deg)" } },
      fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
      fadeUp: {
        from: { opacity: "0", transform: "translateY(18px)" },
        to: { opacity: "1", transform: "translateY(0)" },
      },
      slideUp: {
        from: { opacity: "0", transform: "translateY(14px) scale(0.97)" },
        to: { opacity: "1", transform: "translateY(0) scale(1)" },
      },
      popIn: {
        from: { opacity: "0", transform: "scale(0.85)" },
        to: { opacity: "1", transform: "scale(1)" },
      },
      pieceFall: {
        "0%": {
          opacity: "0",
          transform: "translate(-20px, -40px) rotate(-6deg)",
        },
        "100%": {
          opacity: "0.22",
          transform: "translate(0, 0) rotate(0)",
        },
      },
      pieceSlideLeft: {
        "0%": { opacity: "0", transform: "translate(60px, 0) rotate(4deg)" },
        "100%": { opacity: "0.22", transform: "translate(0, 0) rotate(0)" },
      },
      pieceSlideUp: {
        "0%": {
          opacity: "0",
          transform: "translate(-30px, 60px) rotate(-3deg)",
        },
        "85%": {
          opacity: "0.22",
          transform: "translate(2px, -4px) rotate(0.5deg)",
        },
        "100%": {
          opacity: "0.22",
          transform: "translate(0, 0) rotate(0)",
        },
      },
    },

    tokens: {
      fonts: {
        display: {
          value: "'Playfair Display', Georgia, 'Times New Roman', serif",
        },
        ui: { value: "'DM Sans', system-ui, -apple-system, sans-serif" },
        mono: {
          value: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        },
      },

      radii: {
        sm: { value: "6px" },
        DEFAULT: { value: "8px" },
        md: { value: "12px" },
        lg: { value: "16px" },
        xl: { value: "22px" },
      },

      easings: {
        standard: { value: "cubic-bezier(0.16, 1, 0.3, 1)" },
      },

      // Hero is brand-locked (always dark), so it lives in raw tokens.
      colors: {
        hero: {
          bg: { value: "oklch(13% 0.008 80)" },
          text: { value: "oklch(95% 0.006 80 / 0.94)" },
          textDim: { value: "oklch(95% 0.006 80 / 0.55)" },
          deco: { value: "oklch(82% 0.13 185)" },
        },
      },
    },

    semanticTokens: {
      colors: {
        surface: {
          1: {
            value: {
              base: "oklch(97.5% 0.007 80)",
              _dark: "oklch(14% 0.010 80)",
            },
          },
          2: {
            value: {
              base: "oklch(99% 0.004 80)",
              _dark: "oklch(18.5% 0.012 80)",
            },
          },
          3: {
            value: {
              base: "oklch(94% 0.010 80)",
              _dark: "oklch(11% 0.008 80)",
            },
          },
          4: {
            value: {
              base: "oklch(90% 0.012 80)",
              _dark: "oklch(8% 0.006 80)",
            },
          },
        },

        text: {
          1: {
            value: {
              base: "oklch(20% 0.018 60)",
              _dark: "oklch(92% 0.008 80)",
            },
          },
          2: {
            value: {
              base: "oklch(40% 0.016 60)",
              _dark: "oklch(68% 0.008 80)",
            },
          },
          3: {
            value: {
              base: "oklch(56% 0.012 60)",
              _dark: "oklch(50% 0.007 80)",
            },
          },
        },

        border: {
          DEFAULT: {
            value: {
              base: "oklch(87% 0.010 80)",
              _dark: "oklch(26% 0.012 80)",
            },
          },
          strong: {
            value: {
              base: "oklch(79% 0.012 80)",
              _dark: "oklch(34% 0.013 80)",
            },
          },
        },

        accent: {
          DEFAULT: {
            value: {
              base: "oklch(42% 0.100 190)",
              _dark: "oklch(62% 0.110 190)",
            },
          },
          dim: {
            value: {
              base: "oklch(37% 0.090 190)",
              _dark: "oklch(56% 0.100 190)",
            },
          },
          surface: {
            value: {
              base: "oklch(97% 0.018 190)",
              _dark: "oklch(18% 0.042 190)",
            },
          },
          border: {
            value: {
              base: "oklch(76% 0.055 190)",
              _dark: "oklch(38% 0.075 190)",
            },
          },
          focus: {
            value: {
              base: "oklch(42% 0.100 190 / 0.14)",
              _dark: "oklch(62% 0.110 190 / 0.22)",
            },
          },
        },

        orange: {
          DEFAULT: {
            value: {
              base: "oklch(52% 0.180 50)",
              _dark: "oklch(70% 0.165 50)",
            },
          },
          surface: {
            value: {
              base: "oklch(97% 0.018 50)",
              _dark: "oklch(17% 0.045 50)",
            },
          },
          border: {
            value: {
              base: "oklch(76% 0.075 50 / 0.35)",
              _dark: "oklch(40% 0.095 50 / 0.50)",
            },
          },
        },

        err: {
          DEFAULT: {
            value: {
              base: "oklch(52% 0.210 22)",
              _dark: "oklch(68% 0.195 22)",
            },
          },
          surface: {
            value: {
              base: "oklch(98% 0.012 22)",
              _dark: "oklch(15% 0.038 22)",
            },
          },
          border: {
            value: {
              base: "oklch(52% 0.210 22 / 0.22)",
              _dark: "oklch(68% 0.195 22 / 0.28)",
            },
          },
        },
        ok: {
          DEFAULT: {
            value: {
              base: "oklch(50% 0.170 150)",
              _dark: "oklch(64% 0.155 150)",
            },
          },
          surface: {
            value: {
              base: "oklch(97% 0.016 150)",
              _dark: "oklch(15% 0.038 150)",
            },
          },
        },

        canvas: {
          DEFAULT: {
            value: {
              base: "oklch(94% 0.012 80)",
              _dark: "oklch(13% 0.008 80)",
            },
          },
          dot: {
            value: {
              base: "oklch(30% 0.014 60 / 0.075)",
              _dark: "oklch(95% 0.005 80 / 0.055)",
            },
          },
          text: {
            value: {
              base: "oklch(20% 0.018 60)",
              _dark: "oklch(95% 0.006 80)",
            },
          },
          textDim: {
            value: {
              base: "oklch(45% 0.015 60)",
              _dark: "oklch(60% 0.008 80)",
            },
          },
        },

        glass: {
          DEFAULT: {
            value: {
              base: "oklch(99% 0.005 80 / 0.62)",
              _dark: "oklch(22% 0.014 80 / 0.55)",
            },
          },
          strong: {
            value: {
              base: "oklch(99% 0.005 80 / 0.85)",
              _dark: "oklch(24% 0.014 80 / 0.78)",
            },
          },
          hover: {
            value: {
              base: "oklch(99% 0.005 80 / 0.92)",
              _dark: "oklch(28% 0.016 80 / 0.85)",
            },
          },
          active: {
            value: {
              base: "oklch(94% 0.010 80 / 0.95)",
              _dark: "oklch(32% 0.018 80 / 0.92)",
            },
          },
          border: {
            value: {
              base: "oklch(40% 0.012 60 / 0.16)",
              _dark: "oklch(96% 0.005 80 / 0.13)",
            },
          },
          borderStrong: {
            value: {
              base: "oklch(40% 0.012 60 / 0.24)",
              _dark: "oklch(96% 0.005 80 / 0.22)",
            },
          },
          text: {
            value: {
              base: "oklch(20% 0.018 60)",
              _dark: "oklch(94% 0.008 80)",
            },
          },
          textDim: {
            value: {
              base: "oklch(45% 0.015 60)",
              _dark: "oklch(65% 0.010 80)",
            },
          },
          deco: {
            value: {
              base: "oklch(42% 0.100 190)",
              _dark: "oklch(72% 0.110 190)",
            },
          },
        },

        piece: {
          tint: {
            value: {
              base: "oklch(30% 0.014 60)",
              _dark: "oklch(100% 0 0)",
            },
          },
          tintHi: {
            value: {
              base: "oklch(100% 0 0)",
              _dark: "oklch(100% 0 0)",
            },
          },
        },
      },

      shadows: {
        sm: {
          value: {
            base: "0 1px 3px oklch(15% 0.01 80 / 0.10)",
            _dark: "0 1px 3px oklch(0% 0 0 / 0.30)",
          },
        },
        panel: {
          value: {
            base: "0 32px 64px oklch(15% 0.01 80 / 0.10), 0 8px 20px oklch(15% 0.01 80 / 0.05)",
            _dark:
              "0 32px 64px oklch(0% 0 0 / 0.45), 0 8px 20px oklch(0% 0 0 / 0.25)",
          },
        },
        glass: {
          value: {
            base: "0 12px 36px oklch(15% 0.01 80 / 0.16), 0 1px 0 oklch(100% 0 0 / 0.5) inset",
            _dark:
              "0 12px 36px oklch(0% 0 0 / 0.45), 0 1px 0 oklch(100% 0 0 / 0.06) inset",
          },
        },
      },
    },
  },

  globalCss: {
    "html, body": {
      margin: 0,
      minWidth: "320px",
      minHeight: "100dvh",
      fontFamily: "ui",
      background: "surface.1",
      color: "text.1",
      WebkitFontSmoothing: "antialiased",
      textRendering: "optimizeLegibility",
      textWrap: "pretty",
    },
    html: { overscrollBehavior: "none" },
    ':root[data-theme="light"]': { colorScheme: "light" },
    ':root[data-theme="dark"]': { colorScheme: "dark" },
    "*, *::before, *::after": { boxSizing: "border-box" },

    button: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      border: "1px solid {colors.border.strong}",
      borderRadius: "8px",
      background: "surface.2",
      color: "text.1",
      cursor: "pointer",
      font: "500 0.875rem/1 {fonts.ui}",
      minHeight: "38px",
      padding: "0 14px",
      transition:
        "background 120ms, border-color 120ms, color 120ms, opacity 120ms, transform 80ms",
      userSelect: "none",
      whiteSpace: "nowrap",
    },
    "button:hover:not(:disabled)": { background: "surface.3" },
    "button:active:not(:disabled)": { transform: "scale(0.97)" },
    "button:disabled": { cursor: "not-allowed", opacity: "0.42" },

    'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"])':
      {
        width: "100%",
        border: "1px solid {colors.border}",
        borderRadius: "8px",
        minHeight: "42px",
        padding: "0 14px",
        background: "surface.2",
        color: "text.1",
        font: "400 0.9375rem {fonts.ui}",
        transition: "border-color 120ms, box-shadow 120ms",
        outline: "none",
      },
    'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="color"]):focus': {
      borderColor: "accent",
      boxShadow: "0 0 0 3px {colors.accent.focus}",
    },
    "input::placeholder": { color: "text.3" },

    label: {
      display: "grid",
      gap: "8px",
      font: "600 0.8125rem {fonts.ui}",
      color: "text.2",
      letterSpacing: "0.01em",
    },
  },
});
