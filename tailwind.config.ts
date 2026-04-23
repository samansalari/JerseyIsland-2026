import type { Config } from "tailwindcss";

/**
 * VotePulse design tokens.
 *
 * Palette is sourced from the brand brief and exposed both as Tailwind
 * utilities (e.g. `bg-jersey-red`) AND as CSS variables in globals.css so
 * that third-party embeds, inline styles, and future theming can reference
 * the same values without importing the Tailwind config.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Jersey brand palette
        "jersey-red": {
          DEFAULT: "#A31621",
          dark: "#6B1414",
        },
        gold: "#C8922A",
        navy: "#0D1B2A",
        surface: "#F5F5F0",
        "on-primary": "#F5E8C8",
        success: "#1A6B3A",

        // Semantic aliases → CSS vars (so shadcn-style recipes can plug in later)
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-foreground)",
        border: "var(--color-border)",
      },
      fontFamily: {
        sans: ["var(--font-archivo)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(13, 27, 42, 0.06), 0 4px 12px rgba(13, 27, 42, 0.04)",
        "card-hover":
          "0 2px 4px rgba(13, 27, 42, 0.08), 0 12px 24px rgba(13, 27, 42, 0.08)",
      },
      maxWidth: {
        prose: "68ch",
      },
    },
  },
  plugins: [],
};

export default config;
