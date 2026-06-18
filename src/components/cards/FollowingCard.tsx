import Link from "next/link";
import { Crest } from "@/components/primitives/Crest";
import { BellIcon } from "@/components/primitives/icons";

export interface FollowingRow {
  id: number;
  name: string;
  sublabel: string;
  crest?: string;
}

/**
 * Following card (dark reference): the one LIME surface in the layout, with dark
 * text (text-on-accent), a "Manage" link, and rows of crest + name + sublabel +
 * a bell toggle. Backed by the localStorage profile (section 7); shows an empty
 * prompt when nothing is followed yet.
 */
export function FollowingCard({ rows }: { rows: FollowingRow[] }) {
  return (
    <section className="flex h-full flex-col rounded-card bg-accent-lime p-card text-text-on-accent">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-cardtitle">Following</h3>
        <Link href="/following" className="text-[12px] font-semibold text-text-on-accent/70 hover:text-text-on-accent">
          Manage
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-meta text-text-on-accent/70">
          Follow teams and players to see them here.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5">
              <Crest src={r.crest} name={r.name} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-meta font-semibold leading-tight">{r.name}</p>
                <p className="truncate text-[11px] text-text-on-accent/60">{r.sublabel}</p>
              </div>
              <button
                type="button"
                aria-label={`Notifications for ${r.name}`}
                className="text-text-on-accent/70 transition-colors hover:text-text-on-accent"
              >
                <BellIcon size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
