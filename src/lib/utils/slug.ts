/**
 * Slug helpers. Entity URLs embed the numeric provider id so pages can resolve
 * back to the API without a lookup table, while keeping a human-readable prefix:
 *   "Manchester United" + 33  ->  "manchester-united-33"
 */

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Build "name-id" slug. */
export function entitySlug(name: string, id: number): string {
  const base = slugify(name);
  return base ? `${base}-${id}` : String(id);
}

/** Extract the trailing numeric id from a "name-id" slug. */
export function idFromSlug(slug: string): number | undefined {
  const match = slug.match(/(\d+)$/);
  if (!match) return undefined;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : undefined;
}
