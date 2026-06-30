"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/primitives/icons";

interface SearchResult {
  type: "team" | "player" | "competition";
  name: string;
  href: string;
  sublabel?: string;
}

/**
 * Search autocomplete (CLAUDE.md sections 9 + 12): full-pill input, fires after
 * a minimum of 2 characters, debounced, across teams/players/competitions via
 * /api/search. Keyboard accessible (combobox/listbox roles, arrow nav). The
 * search route lands in M3 — until then this degrades to "no results" rather
 * than erroring.
 */
export function SearchAutocomplete() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results.slice(0, 8));
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      router.push(results[active].href);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2.5 rounded-full border border-hairline bg-card px-4 py-2.5 transition-colors focus-within:border-white/20">
        <span aria-hidden className="text-text-muted">
          <SearchIcon size={17} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search for teams, players, competitions..."
          role="combobox"
          aria-expanded={open}
          aria-controls="search-listbox"
          aria-autocomplete="list"
          className="w-full bg-transparent text-body text-text-primary outline-none placeholder:text-text-muted"
        />
      </div>

      {open && (
        <ul
          id="search-listbox"
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-tile border border-hairline bg-card shadow-soft"
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-meta text-text-secondary">No results</li>
          ) : (
            results.map((r, i) => (
              <li key={r.href} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    router.push(r.href);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-left text-body ${
                    i === active ? "bg-white/5" : ""
                  }`}
                >
                  <span className="text-text-primary">{r.name}</span>
                  <span className="text-[11px] uppercase text-text-secondary">{r.type}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
