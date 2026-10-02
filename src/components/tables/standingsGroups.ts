import type { Standing } from "@/lib/providers/types";

/** Rows bucketed by group label, in first-seen order (one `null` bucket for a plain league). */
export function groupStandings(rows: Standing[]): Map<string | null, Standing[]> {
  const groups = new Map<string | null, Standing[]>();
  for (const r of rows) {
    const arr = groups.get(r.groupLabel) ?? [];
    arr.push(r);
    groups.set(r.groupLabel, arr);
  }
  return groups;
}

/**
 * Only the group(s) containing any of `teamIds` (B15: a match page's Table tab
 * should open on that match's group, not every group in the tournament). Null
 * when there's nothing to narrow: a single-table league, no ids, or none of the
 * teams found — the caller then shows everything.
 */
export function focusGroupRows(rows: Standing[], teamIds: number[]): Standing[] | null {
  const groups = groupStandings(rows);
  if (groups.size < 2 || teamIds.length === 0) return null;
  const wanted = new Set(rows.filter((r) => teamIds.includes(r.teamId)).map((r) => r.groupLabel));
  if (wanted.size === 0 || wanted.size === groups.size) return null;
  return rows.filter((r) => wanted.has(r.groupLabel));
}
