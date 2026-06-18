/**
 * Null-safe stat comparison bar (CLAUDE.md sections 9 + 10). Renders a two-tone
 * proportional bar with the home value on the left and away on the right. If
 * BOTH values are null/undefined the row renders nothing (the caller can hide
 * whole blocks, e.g. xG, when neither side has data). A single missing side
 * shows "-" and contributes 0 to the proportion.
 */
export function StatComparisonBar({
  label,
  home,
  away,
  suffix = "",
}: {
  label: string;
  home?: number;
  away?: number;
  suffix?: string;
}) {
  if (home == null && away == null) return null;

  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a;
  const homePct = total > 0 ? (h / total) * 100 : 50;
  const homeLeads = h > a;
  const awayLeads = a > h;

  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-center justify-between text-meta">
        <span className={`tabular w-12 ${homeLeads ? "font-bold text-text-primary" : "text-text-secondary"}`}>
          {home != null ? `${home}${suffix}` : "-"}
        </span>
        <span className="text-text-muted">{label}</span>
        <span className={`tabular w-12 text-right ${awayLeads ? "font-bold text-text-primary" : "text-text-secondary"}`}>
          {away != null ? `${away}${suffix}` : "-"}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-accent-lime" style={{ width: `${homePct}%` }} />
        <div className="h-full flex-1 bg-white/25" />
      </div>
    </div>
  );
}
