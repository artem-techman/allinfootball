/**
 * Design tokens mirrored from src/styles/globals.css (42 Soccer Visual Style
 * Guide, dark default). Prefer Tailwind classes that point at the CSS variables
 * in components; use these only where a raw value is needed in TS/SVG, and even
 * then prefer the `cssVar` strings so the theme swap keeps working.
 */

export const cssVar = {
  accentLime: "var(--accent-lime)",
  accentLimeDim: "var(--accent-lime-dim)",
  accentLimeSoft: "var(--accent-lime-soft)",
  accentElectric: "var(--accent-electric)",
  accentElectricSoft: "var(--accent-electric-soft)",
  surfaceDark: "var(--surface-dark)",
  surfaceDark2: "var(--surface-dark-2)",
  pageBg: "var(--page-bg)",
  cardBg: "var(--card-bg)",
  cardBg2: "var(--card-bg-2)",
  borderHairline: "var(--border-hairline)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  textOnDark: "var(--text-on-dark)",
  textOnDarkDim: "var(--text-on-dark-dim)",
  textOnAccent: "var(--text-on-accent)",
  liveRed: "var(--live-red)",
  liveMinute: "var(--live-minute)",
  starGold: "var(--star-gold)",
} as const;

/** Raw hex — only for environments that cannot resolve CSS variables. */
export const hex = {
  accentLime: "#d9ff3f",
  accentElectric: "#5a38ff",
  pageBg: "#08090c",
  cardBg: "#131419",
  surfaceDark2: "#1f2128",
  textPrimary: "#ffffff",
  textSecondary: "#9aa0aa",
  textOnAccent: "#0a0b0d",
  liveRed: "#ff4d4d",
  liveMinute: "#d9ff3f",
  starGold: "#ffb627",
} as const;

export const radius = {
  small: "12px",
  card: "16px",
  large: "24px",
  hero: "28px",
  pill: "9999px",
} as const;

export const layout = {
  sidebar: 248,
  rail: 340,
  mainMax: 880,
  gutter: 28,
  columnGap: 24,
  cardPadding: 22,
} as const;

export const motion = {
  hover: "200ms",
  page: "250ms",
  easing: "ease-out",
} as const;

export const typography = {
  greeting: { size: 28, weight: 700, tracking: "-0.02em" },
  section: { size: 19, weight: 600 },
  cardTitle: { size: 16, weight: 600 },
  body: { size: 14, weight: 400 },
  meta: { size: 13, weight: 500 },
} as const;
