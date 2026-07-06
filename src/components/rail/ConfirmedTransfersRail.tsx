import type { Transfer } from "@/lib/providers/types";
import { Crest } from "@/components/primitives/Crest";
import { LocalTime } from "@/components/primitives/LocalTime";

/**
 * Confirmed transfers rail (Transfers page). Completed moves at the biggest
 * European clubs this window — player, the clubs involved, and the fee as the
 * data provider reports it. Factual/neutral data, no betting or affiliate links.
 */
export function ConfirmedTransfersRail({ transfers }: { transfers: Transfer[] }) {
  return (
    <section className="rounded-card border border-hairline bg-card p-card">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-cardtitle text-text-primary">Confirmed transfers</h3>
        <span className="rounded-full bg-card-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
          This window
        </span>
      </header>

      {transfers.length === 0 ? (
        <p className="py-4 text-center text-meta text-text-secondary">
          No confirmed transfers yet this window.
        </p>
      ) : (
        <ul className="divide-y divide-hairline">
          {transfers.map((t) => (
            <li key={`${t.playerId}-${t.date}-${t.to?.id ?? ""}`} className="flex items-center gap-2.5 py-2.5">
              <Crest src={t.to?.crest} name={t.to?.name ?? "Club"} size={20} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-meta font-semibold text-text-primary">{t.playerName}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-text-muted">
                  <span className="truncate">{t.from?.name ?? "—"}</span>
                  <span aria-hidden className="shrink-0 text-accent-lime">→</span>
                  <span className="truncate">{t.to?.name ?? "—"}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                {t.type ? (
                  <span
                    className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      t.type.includes("€") || /\d/.test(t.type)
                        ? "bg-accent-lime-soft text-accent-lime"
                        : "bg-card-2 text-text-secondary"
                    }`}
                  >
                    {t.type}
                  </span>
                ) : (
                  <span className="text-[10px] text-text-muted">Undisclosed</span>
                )}
                <div className="mt-0.5 text-[10px] text-text-muted">
                  <LocalTime iso={`${t.date}T00:00:00Z`} mode="date" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
