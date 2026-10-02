"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Branded route error boundary (B24/N3). Catches render errors in any page
 * below the root layout. "Try again" re-fetches the server components
 * (router.refresh) and resets the boundary, which is what recovers from a
 * transient data failure; a plain reset() would re-render the same error.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Surfaces in the browser console and Vercel logs (server errors carry a digest).
    console.error("[route-error]", error.digest ?? "", error);
  }, [error]);

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
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
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
