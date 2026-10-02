"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Article } from "@/lib/providers/types";
import { BellIcon } from "@/components/primitives/icons";
import { timeAgo } from "@/lib/utils/date";

/** When the panel was last opened (ms epoch), persisted across page loads (B29). */
const LAST_SEEN_KEY = "myfootballtracker.bell.lastSeen";
/** The dot only comes back once a fresh batch of headlines is likely. */
const DOT_RETURNS_AFTER_MS = 6 * 60 * 60_000;

function readLastSeen(): number {
  try {
    return Number(window.localStorage.getItem(LAST_SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastSeen(at: number) {
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, String(at));
  } catch {
    /* storage blocked: the dot just clears for this page view */
  }
}

/**
 * Notifications bell (#2). Opens a dropdown with the latest football headlines
 * (loaded once, on first open) as your "updates", with a link to the full news
 * feed. Closes on outside click / Escape. The lime dot marks unseen items and
 * clears once the panel is opened; the "seen" time is kept in localStorage so
 * the dot no longer returns on every navigation (B29).
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [articles, setArticles] = useState<Article[] | null>(null);
  // Start "seen" (no dot) so server HTML and hydration agree; the stored marker
  // decides after mount whether the dot appears.
  const [seen, setSeen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSeen(Date.now() - readLastSeen() < DOT_RETURNS_AFTER_MS);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function openPanel() {
    setOpen((v) => !v);
    setSeen(true);
    writeLastSeen(Date.now());
    if (articles === null) {
      try {
        const res = await fetch("/api/news?limit=6", { cache: "no-store" });
        const data = (await res.json()) as { articles: Article[] };
        setArticles(data.articles ?? []);
      } catch {
        setArticles([]);
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={openPanel}
        aria-label="Latest headlines"
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-hairline bg-card text-text-secondary transition-colors hover:text-text-primary"
      >
        <BellIcon size={18} />
        {!seen && (
          <span
            aria-hidden
            className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent-gradient ring-2 ring-card"
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-tile border border-hairline bg-card shadow-elevated">
          <div className="border-b border-hairline px-4 py-2.5">
            {/* "Latest", not "Notifications": these are headlines, not personal alerts (B29). */}
            <p className="text-cardtitle text-text-primary">Latest</p>
            <p className="text-[11px] text-text-muted">Headlines across your competitions</p>
          </div>

          {articles === null ? (
            <p className="px-4 py-6 text-center text-meta text-text-secondary">Loading…</p>
          ) : articles.length === 0 ? (
            <p className="px-4 py-6 text-center text-meta text-text-secondary">You&apos;re all caught up</p>
          ) : (
            <ul className="max-h-80 divide-y divide-hairline overflow-y-auto">
              {articles.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 transition-colors hover:bg-white/5"
                  >
                    <p className="line-clamp-2 text-meta font-medium text-text-primary">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {a.sourceName} · {timeAgo(a.publishedAtUtc)}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/news"
            onClick={() => setOpen(false)}
            className="block border-t border-hairline px-4 py-2.5 text-center text-meta font-semibold text-text-primary hover:text-accent-lime"
          >
            See all news
          </Link>
        </div>
      )}
    </div>
  );
}
