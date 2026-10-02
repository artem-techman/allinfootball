import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { LiveNowRail } from "@/components/rail/LiveNowRail";
import { ConfirmedTransfersRail } from "@/components/rail/ConfirmedTransfersRail";
import { NewsRiver } from "@/components/news/NewsRiver";
import { NewsFilters } from "@/components/news/NewsFilters";
import { getNews } from "@/lib/news";
import { loadConfirmedTransfers } from "@/lib/transfers";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { buildMetadata } from "@/lib/seo/metadata";
import { competitionListSentence } from "@/lib/seo/copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Football News",
  description: `The latest football news across ${competitionListSentence()}: headlines from trusted sources, linked to the original publisher.`,
  path: "/news",
});

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const comp = sp.comp;
  const transfer = sp.tag === "transfers";
  const [articles, transfers] = await Promise.all([
    getNews({ comp, transfer, limit: 40 }),
    transfer ? loadConfirmedTransfers() : Promise.resolve([]),
  ]);
  const active = comp ?? (transfer ? "transfers" : "all");
  const heading = comp ? `${getCompetitionBySlug(comp)?.name ?? "News"} News` : transfer ? "Transfers" : "Football News";

  return (
    <AppShell
      rail={
        <>
          <LiveNowRail />
          {/* Confirmed transfers under Live Now on the Transfers view (desktop rail). */}
          {transfer && (
            <div className="hidden min-[1201px]:block">
              <ConfirmedTransfersRail transfers={transfers} />
            </div>
          )}
        </>
      }
    >
      <header className="mb-5">
        <h1 className="text-greeting text-text-primary">{heading}</h1>
        <p className="mt-1 text-meta text-text-secondary">Headlines from BBC Sport, The Guardian and Sky Sports.</p>
      </header>
      <NewsFilters active={active} />
      <NewsRiver articles={articles} />
    </AppShell>
  );
}
