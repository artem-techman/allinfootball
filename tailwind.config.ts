import type { Config } from "tailwindcss";

/**
 * Tailwind is driven ENTIRELY by the design tokens in globals.css (the 42 Soccer
 * Visual Style Guide). Every color references a CSS variable so the light-theme
 * variant is a pure token swap and components never carry hardcoded hex.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "accent-gradient": "var(--accent-gradient)",
      },
      colors: {
        accent: {
          lime: "var(--accent-lime)",
          "lime-dim": "var(--accent-lime-dim)",
          "lime-soft": "var(--accent-lime-soft)",
          electric: "var(--accent-electric)",
          "electric-soft": "var(--accent-electric-soft)",
        },
        surface: {
          dark: "var(--surface-dark)",
          "dark-2": "var(--surface-dark-2)",
        },
        page: "var(--page-bg)",
        card: {
          DEFAULT: "var(--card-bg)",
          2: "var(--card-bg-2)",
        },
        hairline: "var(--border-hairline)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          "on-dark": "var(--text-on-dark)",
          "on-dark-dim": "var(--text-on-dark-dim)",
          "on-accent": "var(--text-on-accent)",
        },
        live: {
          red: "var(--live-red)",
          minute: "var(--live-minute)",
        },
        star: "var(--star-gold)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "SF Pro Display", "system-ui", "sans-serif"],
      },
      fontSize: {
        greeting: ["28px", { lineHeight: "34px", fontWeight: "700", letterSpacing: "-0.02em" }],
        section: ["19px", { lineHeight: "25px", fontWeight: "600", letterSpacing: "-0.01em" }],
        cardtitle: ["16px", { lineHeight: "22px", fontWeight: "600" }],
        body: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        meta: ["13px", { lineHeight: "18px", fontWeight: "500" }],
      },
      borderRadius: {
        sm2: "12px",
        card: "16px",
        lg2: "24px",
        hero: "28px",
        tile: "12px",
      },
      maxWidth: {
        main: "880px",
      },
      spacing: {
        sidebar: "248px",
        rail: "340px",
        card: "22px",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(0, 0, 0, 0.25)",
        elevated: "0 8px 30px rgba(0, 0, 0, 0.35)",
        "lime-glow": "0 0 0 1px rgba(217,255,63,0.0), 0 10px 40px rgba(217,255,63,0.10)",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "live-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "live-pulse": "live-pulse 1.4s ease-in-out infinite",
        "page-in": "page-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
