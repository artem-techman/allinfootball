import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { provider } from "@/lib/providers";
import { idFromSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const coach = id ? await provider.getCoach(id).catch(() => undefined) : undefined;
  return { title: coach?.name ?? "Coach", alternates: { canonical: `/coach/${slug}` } };
}

export default async function CoachPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();
  const coach = await provider.getCoach(id).catch(() => undefined);
  if (!coach) notFound();

  const photo = coach.photo ?? `https://media.api-sports.io/football/coachs/${coach.id}.png`;
  const meta = [coach.nationality, coach.age ? `Age ${coach.age}` : null, coach.teamName].filter(Boolean).join(" · ");

  return (
    <AppShell>
      <header className="flex items-center gap-4 rounded-card border border-hairline bg-card p-card">
        <span
          className="h-20 w-20 shrink-0 rounded-full bg-card-2 bg-cover bg-center"
          style={{ backgroundImage: `url(${photo})` }}
          role="img"
          aria-label={coach.name}
        />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Coach</p>
          <h1 className="text-greeting text-text-primary">{coach.name}</h1>
          <p className="mt-0.5 text-meta text-text-secondary">{meta || "—"}</p>
        </div>
      </header>
    </AppShell>
  );
}
