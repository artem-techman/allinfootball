import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/primitives/EmptyState";

export const dynamic = "force-dynamic";

/** Referees have no dedicated provider endpoint, so we present the name only. */
function refereeName(slug: string): string {
  return slug
    .replace(/-\d+$/, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: refereeName(slug) || "Referee", alternates: { canonical: `/referee/${slug}` } };
}

export default async function RefereePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const name = refereeName(slug);

  return (
    <AppShell>
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Referee</p>
        <h1 className="text-greeting text-text-primary">{name || "Referee"}</h1>
      </header>
      <EmptyState
        title="Referee profiles are limited"
        hint="Match appointments appear on individual match pages."
      />
    </AppShell>
  );
}
