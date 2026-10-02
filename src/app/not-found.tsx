import { Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { Logo } from "@/components/primitives/Logo";
import { ArrowRightIcon } from "@/components/primitives/icons";

/**
 * Branded 404 (B24/N3). Rendered for unknown URLs and for every notFound() call
 * (unknown match/team/player ids, expired news items, bad dates).
 *
 * The AppShell's sidebar reads useSearchParams(), which needs a Suspense
 * boundary when this page is prerendered (the static /_not-found). The fallback
 * is the same message without the shell, so the HTML is never empty.
 */
function NotFoundMessage() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center py-14 text-center">
      <p className="text-[64px] font-extrabold leading-none tracking-[-0.04em] text-accent-lime tabular-nums">404</p>
      <h1 className="mt-4 text-greeting text-text-primary">Page not found</h1>
      <p className="mt-2 text-body text-text-secondary">
        This page doesn&apos;t exist, or it has moved. News items expire after a few days, and
        matches outside the competitions we cover don&apos;t have a page.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-tile bg-accent-gradient px-5 py-2.5 text-meta font-semibold text-text-on-accent"
        >
          Go to home <ArrowRightIcon size={15} />
        </Link>
        <Link
          href="/matches"
          className="inline-flex items-center rounded-tile border border-hairline bg-card px-5 py-2.5 text-meta font-semibold text-text-primary hover:bg-card-2"
        >
          Today&apos;s matches
        </Link>
        <Link
          href="/news"
          className="inline-flex items-center rounded-tile border border-hairline bg-card px-5 py-2.5 text-meta font-semibold text-text-primary hover:bg-card-2"
        >
          Latest news
        </Link>
      </div>
    </section>
  );
}

export default function NotFound() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page px-4 py-6 min-[821px]:px-10">
          <Logo />
          <NotFoundMessage />
        </div>
      }
    >
      <AppShell>
        <NotFoundMessage />
      </AppShell>
    </Suspense>
  );
}
