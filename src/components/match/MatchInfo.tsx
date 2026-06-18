import type { Match } from "@/lib/providers/types";

/**
 * Match info block (CLAUDE.md section 8): referee, stadium, attendance,
 * broadcaster. Renders "-" for fields the provider omits (API-Football usually
 * has referee + venue; attendance/broadcaster are frequently absent).
 */
export function MatchInfo({ match }: { match: Match }) {
  const stadium = [match.venueName, match.city].filter(Boolean).join(", ");
  const rows: { label: string; value?: string }[] = [
    { label: "Referee", value: match.refereeName },
    { label: "Stadium", value: stadium || undefined },
    { label: "Attendance", value: match.attendance ? match.attendance.toLocaleString("en-GB") : undefined },
    { label: "Broadcaster", value: match.broadcaster },
  ];

  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <h3 className="mb-3 text-cardtitle text-text-primary">Match info</h3>
      <dl className="divide-y divide-hairline">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 text-body">
            <dt className="text-text-secondary">{r.label}</dt>
            <dd className="text-text-primary">{r.value ?? "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
