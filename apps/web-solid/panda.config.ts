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
    tokens: {
      fonts: {
        display: {
          value:
            "'Playfair Display', Georgia, 'Times New Roman', serif",
        },
        ui: {
          value: "'DM Sans', system-ui, -apple-system, sans-serif",
        },
        mono: {
          value:
            "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        },
      },

      // Canvas tokens — always dark; never overridden by theme.
      colors: {
        canvas: {
          base: { value: "#1e1b16" },
          rim: { value: "#35302a" },
          dot: { value: "rgba(255, 248, 235, 0.055)" },
          glass: {
            base: { value: "rgba(24, 21, 16, 0.90)" },
            border: { value: "rgba(255, 248, 235, 0.09)" },
            hover: { value: "rgba(255, 248, 235, 0.10)" },
          },
        },
        onCanvas: {
          DEFAULT: { value: "rgba(255, 248, 235, 0.95)" },
          strong: { value: "rgba(255, 248, 235, 0.75)" },
          mid: { value: "rgba(255, 248, 235, 0.65)" },
          dim: { value: "rgba(255, 248, 235, 0.50)" },
          fade: { value: "rgba(255, 248, 235, 0.40)" },
          sub: { value: "rgba(255, 248, 235, 0.38)" },
          ghost: { value: "rgba(255, 248, 235, 0.30)" },
        },
        piece: {
          frame: { value: "rgba(255, 248, 235, 0.10)" },
          fill: { value: "rgba(255, 253, 250, 0.05)" },
          edge: {
            DEFAULT: { value: "rgba(255, 255, 255, 0.65)" },
            locked: { value: "rgba(255, 255, 255, 0.18)" },
          },
        },
        okCanvas: {
          border: { value: "rgba(22, 134, 75, 0.45)" },
          ring: { value: "rgba(22, 134, 75, 0.35)" },
          glow: { value: "rgba(22, 134, 75, 0.12)" },
          glass: { value: "rgba(15, 60, 35, 0.88)" },
          text: { value: "#7adfa8" },
        },
        drop: {
          border: { value: "rgba(13, 107, 98, 0.50)" },
          dot: { value: "rgba(13, 107, 98, 0.07)" },
        },
      },
    },

    semanticTokens: {
      colors: {
        // Ink — text
        ink: {
          DEFAULT: { value: { base: "#1a1208", _dark: "#f0e6d2" } },
          60: { value: { base: "#6b5f50", _dark: "#9e8f7e" } },
          40: { value: { base: "#7a6b5d", _dark: "#908070" } },
        },
        // Paper — surfaces
        paper: {
          DEFAULT: { value: { base: "#f7f2e8", _dark: "#181510" } },
          raised: { value: { base: "#fdfaf5", _dark: "#201d17" } },
          sunken: { value: { base: "#f0ead7", _dark: "#131009" } },
        },
        // Borders
        border: {
          DEFAULT: { value: { base: "#e0d8cc", _dark: "#2c2820" } },
          strong: { value: { base: "#c8bfb2", _dark: "#3a352c" } },
        },
        // Accent — warm red
        accent: {
          DEFAULT: { value: { base: "#c1440e", _dark: "#c1440e" } },
          dark: { value: { base: "#a33609", _dark: "#a33609" } },
          surf: { value: { base: "#fef3ee", _dark: "#2e0f04" } },
          border: {
            value: {
              base: "rgba(193, 68, 14, 0.20)",
              _dark: "rgba(193, 68, 14, 0.20)",
            },
          },
        },
        // Teal — primary action
        teal: {
          DEFAULT: { value: { base: "#0d6b62", _dark: "#0d6b62" } },
          dark: { value: { base: "#0a5550", _dark: "#0a5550" } },
          surf: { value: { base: "#edf7f5", _dark: "#071e1b" } },
          border: { value: { base: "#9dcec9", _dark: "#1a5a55" } },
          focus: {
            value: {
              base: "rgba(13, 107, 98, 0.15)",
              _dark: "rgba(13, 107, 98, 0.25)",
            },
          },
        },
        // Semantic
        ok: {
          DEFAULT: { value: { base: "#16864b", _dark: "#16864b" } },
          surf: { value: { base: "#edfdf5", _dark: "#071a10" } },
        },
        err: {
          DEFAULT: { value: { base: "#c41c1c", _dark: "#c41c1c" } },
          surf: { value: { base: "#fff0f0", _dark: "#1e0707" } },
          border: {
            value: {
              base: "rgba(196, 28, 28, 0.22)",
              _dark: "rgba(196, 28, 28, 0.22)",
            },
          },
          shadow: {
            value: {
              base: "rgba(196, 28, 28, 0.12)",
              _dark: "rgba(196, 28, 28, 0.12)",
            },
          },
        },
        // Adaptive misc
        dot: {
          value: {
            base: "rgba(26, 18, 8, 0.07)",
            _dark: "rgba(240, 230, 210, 0.05)",
          },
        },
        panelInset: {
          value: {
            base: "rgba(255, 255, 255, 0.90)",
            _dark: "rgba(255, 255, 255, 0.04)",
          },
        },
      },

      shadows: {
        panel: {
          value: {
            base: "0 36px 72px rgba(26, 18, 8, 0.11), 0 8px 24px rgba(26, 18, 8, 0.05)",
            _dark:
              "0 36px 72px rgba(0, 0, 0, 0.45), 0 8px 24px rgba(0, 0, 0, 0.25)",
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
      background: "paper",
      color: "ink",
      fontSynthesis: "none",
      textRendering: "optimizeLegibility",
      WebkitFontSmoothing: "antialiased",
    },
    ':root[data-theme="light"]': { colorScheme: "light" },
    ':root[data-theme="dark"]': { colorScheme: "dark" },
    "*, *::before, *::after": { boxSizing: "border-box" },
  },
});
