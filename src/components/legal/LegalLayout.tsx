import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

/** Shared chrome for the static About / Privacy / Terms pages. */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <AppShell>
      <article className="max-w-3xl">
        <h1 className="text-greeting text-text-primary">{title}</h1>
        {updated && <p className="mt-1 text-meta text-text-muted">Last updated: {updated}</p>}
        <div className="mt-7 space-y-7">{children}</div>
      </article>
    </AppShell>
  );
}

/** A titled section of a legal/static page. */
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-cardtitle font-semibold text-text-primary">{heading}</h2>
      <div className="space-y-2.5 text-meta leading-relaxed text-text-secondary [&_a]:text-accent-lime [&_a:hover]:underline">
        {children}
      </div>
    </section>
  );
}
