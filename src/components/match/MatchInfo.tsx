import type { Match } from "@/lib/providers/types";

/**
 * Match info block (CLAUDE.md section 8): referee, stadium, attendance,
 * broadcaster. Rows the provider leaves empty are hidden rather than shown as
 * "-" (B30: API-Football usually has referee + venue; attendance/broadcaster
 * are frequently absent), and the block disappears if nothing is left.
 */
export function MatchInfo({ match }: { match: Match }) {
  const stadium = [match.venueName, match.city].filter(Boolean).join(", ");
  const rows = [
    { label: "Referee", value: match.refereeName },
    { label: "Stadium", value: stadium },
    { label: "Attendance", value: match.attendance ? match.attendance.toLocaleString("en-GB") : undefined },
    { label: "Broadcaster", value: match.broadcaster },
  ].filter((r): r is { label: string; value: string } => Boolean(r.value?.trim()) && r.value?.trim() !== "-");
  if (rows.length === 0) return null;

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <h3 className="mb-3 text-cardtitle text-text-primary">Match info</h3>
      <dl className="divide-y divide-hairline">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 text-body">
            <dt className="text-text-secondary">{r.label}</dt>
            <dd className="text-text-primary">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
