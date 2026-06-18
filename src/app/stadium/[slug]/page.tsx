import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { provider } from "@/lib/providers";
import { idFromSlug } from "@/lib/utils/slug";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  const venue = id ? await provider.getVenue(id).catch(() => undefined) : undefined;
  return { title: venue?.name ?? "Stadium", alternates: { canonical: `/stadium/${slug}` } };
}

export default async function StadiumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();
  const venue = await provider.getVenue(id).catch(() => undefined);
  if (!venue) notFound();

  const facts: { label: string; value?: string }[] = [
    { label: "City", value: [venue.city, venue.country].filter(Boolean).join(", ") || undefined },
    { label: "Capacity", value: venue.capacity ? venue.capacity.toLocaleString("en-GB") : undefined },
    { label: "Surface", value: venue.surface },
  ];

  return (
    <AppShell>
      <div className="space-y-5">
        {venue.image && (
          <div
            className="h-56 w-full rounded-card border border-hairline bg-cover bg-center"
            style={{ backgroundImage: `url(${venue.image})` }}
            role="img"
            aria-label={venue.name}
          />
        )}
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Stadium</p>
          <h1 className="text-greeting text-text-primary">{venue.name}</h1>
        </header>
        <section className="rounded-card border border-hairline bg-card p-card">
          <dl className="divide-y divide-hairline">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center justify-between py-2 text-body">
                <dt className="text-text-secondary">{f.label}</dt>
                <dd className="text-text-primary">{f.value ?? "-"}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
