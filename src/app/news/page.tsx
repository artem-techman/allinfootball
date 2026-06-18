import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { LiveNowRail } from "@/components/rail/LiveNowRail";
import { NewsRiver } from "@/components/news/NewsRiver";
import { NewsFilters } from "@/components/news/NewsFilters";
import { getNews } from "@/lib/news";
import { getCompetitionBySlug } from "@/lib/constants/competitions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Football News",
  description:
    "The latest football news across the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, MLS and the World Cup — from trusted sources.",
  alternates: { canonical: "/news" },
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const comp = sp.comp;
  const transfer = sp.tag === "transfers";
  const articles = await getNews({ comp, transfer, limit: 40 });
  const active = comp ?? (transfer ? "transfers" : "all");
  const heading = comp ? `${getCompetitionBySlug(comp)?.name ?? "News"} News` : transfer ? "Transfers" : "Football News";

  return (
    <AppShell rail={<LiveNowRail />}>
      <header className="mb-5">
        <h1 className="text-greeting text-text-primary">{heading}</h1>
        <p className="mt-1 text-meta text-text-secondary">Headlines from BBC Sport, The Guardian and Sky Sports.</p>
      </header>
      <NewsFilters active={active} />
      <NewsRiver articles={articles} />
    </AppShell>
  );
}
