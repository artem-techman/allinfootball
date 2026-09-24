/**
 * Site feedback — shared between the sidebar widget (renders the form) and
 * /api/feedback (validates + stores). Replaces the Messi-shirt raffle. A message
 * is required; an optional 1–5 rating and an optional email (for a reply) round
 * it out. No account, no PII beyond an email the visitor chooses to give.
 */

export const MESSAGE_MIN = 3;
export const MESSAGE_MAX = 2000;
export const EMAIL_MAX = 254;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidMessage(v: unknown): v is string {
  return typeof v === "string" && v.trim().length >= MESSAGE_MIN && v.trim().length <= MESSAGE_MAX;
}

/** Rating is optional; when present it must be an integer 1–5. */
export function isValidRating(v: unknown): boolean {
  return v == null || (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5);
}

/** Email is optional; when present (non-empty) it must look like an email. */
export function isValidEmailOptional(v: unknown): boolean {
  if (v == null || v === "") return true;
  return typeof v === "string" && v.trim().length <= EMAIL_MAX && EMAIL_RE.test(v.trim());
}
