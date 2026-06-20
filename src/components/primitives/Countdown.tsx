"use client";

import { useEffect, useState } from "react";

/**
 * Live "starts in" countdown to a UTC kickoff. The remaining time depends on the
 * viewer's current clock, which the server can't know, so the first render emits
 * a stable placeholder and the real value fills in on mount (avoiding a hydration
 * mismatch). It then ticks every second.
 *
 * Format adapts to the distance: "3d 4h 12m" when a day or more away, "4h 12m 06s"
 * within a day, "12m 06s" within the hour. Once kickoff passes it reads "Kicking off".
 */
export function Countdown({ kickoffUtc }: { kickoffUtc: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const target = new Date(kickoffUtc).getTime();
    const tick = () => setLabel(formatRemaining(target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kickoffUtc]);

  return (
    <div className="mt-auto border-t border-hairline pt-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
        Starts in
      </div>
      <div className="tabular mt-0.5 text-[13px] font-bold text-text-primary">
        {label ?? "—"}
      </div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Kicking off";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${hours}h ${pad(mins)}m`;
  if (hours > 0) return `${hours}h ${pad(mins)}m ${pad(secs)}s`;
  return `${mins}m ${pad(secs)}s`;
}
