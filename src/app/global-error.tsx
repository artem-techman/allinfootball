"use client";

import { useEffect } from "react";
import "@/styles/globals.css";

/**
 * Last-resort boundary (B24/N3): replaces the ROOT layout when the layout itself
 * throws, so it renders its own <html>/<body> and deliberately avoids the app
 * shell (which may be what failed). Styling comes from the same CSS tokens.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-page text-text-primary">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center" role="alert">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-accent-lime">My Football Tracker</p>
          <h1 className="mt-3 text-greeting text-text-primary">Something went wrong</h1>
          <p className="mt-2 text-body text-text-secondary">
            The site hit an unexpected error. Please try again in a moment.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center rounded-tile bg-accent-gradient px-5 py-2.5 text-meta font-semibold text-text-on-accent"
            >
              Try again
            </button>
            {/* A full page load, not a client navigation: the root layout is broken. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex items-center rounded-tile border border-hairline bg-card px-5 py-2.5 text-meta font-semibold text-text-primary"
            >
              Go to home
            </a>
          </div>
          {error.digest && (
            <p className="mt-6 text-[12px] text-text-muted">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
