/**
 * Messi-shirt raffle — shared between the sidebar widget (renders the steps)
 * and /api/raffle (validates entries). Name + email are collected with bundled
 * consent (stated in the widget fine print and the privacy policy); the three
 * profile questions attach segmentation to each lead (age for 18+ share,
 * favourite team, annual football spend).
 */

export const RAFFLE_ID = "messi-shirt-2026";

export interface RaffleOption {
  id: string;
  label: string;
}

/** One-tap questions (favourite team is a free-text step in the widget). */
export const AGE_OPTIONS: RaffleOption[] = [
  { id: "u18", label: "Academy (under 18)" },
  { id: "a18_24", label: "18–24" },
  { id: "a25_34", label: "25–34" },
  { id: "a35_44", label: "35–44" },
  { id: "a45", label: "45+ · seen it all" },
];

export const SPEND_OPTIONS: RaffleOption[] = [
  { id: "s0", label: "€0 — love is free" },
  { id: "s100", label: "Under €100" },
  { id: "s500", label: "€100–500" },
  { id: "s1000", label: "€500–1,000" },
  { id: "s1000plus", label: "€1,000+ · all in" },
];

export const NAME_MAX = 60;
export const TEAM_MAX = 40;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidName(v: unknown): v is string {
  return typeof v === "string" && v.trim().length >= 2 && v.trim().length <= NAME_MAX;
}

export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && v.trim().length <= 254 && EMAIL_RE.test(v.trim());
}

export function isValidTeam(v: unknown): v is string {
  return typeof v === "string" && v.trim().length >= 2 && v.trim().length <= TEAM_MAX;
}

export function isValidAge(v: unknown): v is string {
  return typeof v === "string" && AGE_OPTIONS.some((o) => o.id === v);
}

export function isValidSpend(v: unknown): v is string {
  return typeof v === "string" && SPEND_OPTIONS.some((o) => o.id === v);
}
