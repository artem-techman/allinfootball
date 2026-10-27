"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Branded route error boundary (B24/N3). Catches render errors in any page
 * below the root layout.
 *
 * It heals itself before it ever shows: almost every error here is transient
 * (a provider hiccup, a stale database connection, or a browser still holding
 * files from before a deploy), and "Try again" always fixed it — so it now
 * tries once on its own (2026-10-27).
 *  - A stale-deploy error (chunk/module failed to load) → one full reload.
 *  - Anything else → one silent refresh (router.refresh + reset).
 * Each is attempted once per page per minute (sessionStorage), so a genuinely
 * broken page still lands on the message below instead of looping.
 */
const STALE_BUILD = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically/i;
const WINDOW_MS = 60_000;

function claimRetry(kind: string): boolean {
  try {
    const key = `mft-auto-${kind}:${window.location.pathname}`;
    const last = Number(sessionStorage.getItem(key) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return false; // storage blocked: fall back to the manual button
  }
}

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [healing, setHealing] = useState(true);
  const tried = useRef(false);

  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  useEffect(() => {
    // Surfaces in the browser console and Vercel logs (server errors carry a digest).
    console.error("[route-error]", error.digest ?? "", error);
    if (tried.current) return;
    tried.current = true;
    const text = `${error.name} ${error.message}`;
    if (STALE_BUILD.test(text) && claimRetry("reload")) {
      window.location.reload();
      return;
    }
    if (claimRetry("refresh")) {
      const t = setTimeout(retry, 250);
      // If the retry didn't clear the error, show the message.
      const show = setTimeout(() => setHealing(false), 4_000);
      return () => {
        clearTimeout(t);
        clearTimeout(show);
      };
    }
    setHealing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  if (healing) {
    return (
      <AppShell>
        <section className="mx-auto flex max-w-xl flex-col items-center py-14 text-center" aria-busy="true">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-accent-lime motion-reduce:animate-none" aria-hidden />
          <p className="mt-4 text-meta text-text-secondary">Loading…</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto flex max-w-xl flex-col items-center py-14 text-center" role="alert">
        <h1 className="text-greeting text-text-primary">Something went wrong</h1>
        <p className="mt-2 text-body text-text-secondary">
          This page didn&apos;t load properly. It&apos;s usually a brief hiccup fetching match data,
          so trying again normally fixes it.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={retry}
            className="inline-flex items-center rounded-tile bg-accent-gradient px-5 py-2.5 text-meta font-semibold text-text-on-accent disabled:opacity-60"
          >
            {pending ? "Retrying…" : "Try again"}
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-tile border border-hairline bg-card px-5 py-2.5 text-meta font-semibold text-text-primary hover:bg-card-2"
          >
            Go to home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-6 text-[12px] text-text-muted">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </section>
    </AppShell>
  );
}
