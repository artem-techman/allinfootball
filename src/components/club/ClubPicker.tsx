"use client";

import { useEffect, useState } from "react";
import { Crest } from "@/components/primitives/Crest";
import { SearchIcon } from "@/components/primitives/icons";
import { idFromSlug } from "@/lib/utils/slug";

export interface PickedClub {
  id: number;
  name: string;
  crest?: string;
}

const crest = (id: number) => `https://media.api-sports.io/football/teams/${id}.png`;

/** Popular clubs for one-tap picking; anything else is a search away. */
const POPULAR: PickedClub[] = [
  { id: 42, name: "Arsenal" }, { id: 50, name: "Manchester City" }, { id: 40, name: "Liverpool" },
  { id: 33, name: "Manchester United" }, { id: 49, name: "Chelsea" }, { id: 47, name: "Tottenham" },
  { id: 541, name: "Real Madrid" }, { id: 529, name: "Barcelona" }, { id: 157, name: "Bayern München" },
  { id: 85, name: "Paris Saint Germain" }, { id: 505, name: "Inter" }, { id: 496, name: "Juventus" },
].map((c) => ({ ...c, crest: crest(c.id) }));

/** Pick a club: popular grid + search across every club we cover. */
export function ClubPicker({ onPick, busy }: { onPick: (club: PickedClub) => void; busy?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedClub[] | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: { type: string; name: string; href: string }[] };
        setResults(
          data.results
            .filter((r) => r.type === "team")
            .map((r) => {
              const id = idFromSlug(r.href.split("/").pop() ?? "") ?? 0;
              return { id, name: r.name, crest: crest(id) };
            })
            .filter((c) => c.id > 0),
        );
      } catch {
        /* aborted or offline: keep the last results */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const list = results ?? POPULAR;
  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search for your club</span>
        <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your club…"
          autoFocus
          className="w-full rounded-full border border-hairline bg-card-2 py-2.5 pl-10 pr-4 text-body text-text-primary placeholder:text-text-muted focus:border-accent-lime focus:outline-none"
        />
      </label>
      <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide text-text-muted">
        {results ? (results.length ? "Clubs" : "No club found in the competitions we cover") : "Popular"}
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-2.5 rounded-tile border border-hairline bg-card px-3 py-2.5 text-left text-meta font-semibold text-text-primary transition-colors hover:border-accent-lime disabled:opacity-50"
            >
              <Crest src={c.crest} name={c.name} size={22} />
              <span className="truncate">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
