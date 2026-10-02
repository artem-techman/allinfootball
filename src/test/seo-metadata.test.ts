import { describe, it, expect } from "vitest";
import { absoluteUrl, buildMetadata, SITE_NAME, SITE_URL } from "@/lib/seo/metadata";
import { competitionTabMetadata } from "@/lib/seo/competition";
import { competitionCountWord, competitionListSentence, competitionStrap } from "@/lib/seo/copy";
import { canonicalMatchSlug, matchDescription, matchShareText } from "@/lib/seo/matchShare";
import { breadcrumb, competitionTableCrumb, sportsEvent } from "@/components/seo/JsonLd";
import { COMPETITIONS } from "@/lib/constants/competitions";
import type { Match } from "@/lib/providers/types";

/** og:url and canonical must be the same absolute URL (B6 contract). */
function urls(m: ReturnType<typeof buildMetadata>) {
  const og = m.openGraph as { url?: string | URL; siteName?: string; images?: unknown } | undefined;
  const canonical = m.alternates?.canonical;
  return { og: og?.url?.toString(), canonical: canonical?.toString(), og_: og };
}

const PATHS = [
  "/",
  "/match/arsenal-chelsea-1234",
  "/team/arsenal-42",
  "/player/e-haaland-1100",
  "/competition/premier-league/table",
  "/competition/world-cup/fixtures",
  "/matches",
  "/matches/2026-10-17",
  "/news",
  "/news/some-headline",
  "/feed",
  "/about",
  "/privacy",
  "/terms",
];

describe("buildMetadata contract (B6)", () => {
  it.each(PATHS)("og:url equals canonical for %s", (path) => {
    const m = buildMetadata({ title: "T", description: "D", path });
    const { og, canonical } = urls(m);
    expect(canonical).toBeDefined();
    expect(og).toBe(canonical);
    expect(canonical!.startsWith(SITE_URL)).toBe(true);
  });

  it("never falls back to the homepage URL for a deep page", () => {
    const { og } = urls(buildMetadata({ title: "Arsenal vs Chelsea", description: "x", path: "/match/arsenal-chelsea-1" }));
    expect(og).toBe(`${SITE_URL}/match/arsenal-chelsea-1`);
  });

  it("sets site name, og title/description and a large twitter card", () => {
    const m = buildMetadata({ title: "Arsenal", description: "Desc", path: "/team/arsenal-42" });
    const og = m.openGraph as { siteName?: string; title?: string; description?: string };
    expect(og.siteName).toBe(SITE_NAME);
    expect(og.title).toBe("Arsenal");
    expect(og.description).toBe("Desc");
    expect((m.twitter as { card?: string }).card).toBe("summary_large_image");
  });

  it("uses the site image by default, never a third-party image unless asked", () => {
    const og = buildMetadata({ title: "x", description: "y", path: "/news/a" }).openGraph as { images?: { url: string }[] };
    expect(og.images?.[0]?.url).toBe("/opengraph-image");
  });

  it("omits the images key entirely when the segment has its own opengraph-image file", () => {
    // Next only applies file-based images when the route's openGraph has NO images key.
    const og = buildMetadata({ title: "x", description: "y", path: "/match/a-1", image: "file" }).openGraph!;
    expect(Object.prototype.hasOwnProperty.call(og, "images")).toBe(false);
  });

  it("passes robots through (noindex for news interstitials)", () => {
    const m = buildMetadata({ title: "x", description: "y", path: "/news/a", robots: { index: false, follow: true } });
    expect(m.robots).toEqual({ index: false, follow: true });
  });

  it("normalises paths", () => {
    expect(absoluteUrl("/")).toBe(SITE_URL);
    expect(absoluteUrl("about")).toBe(`${SITE_URL}/about`);
    expect(absoluteUrl("/about/")).toBe(`${SITE_URL}/about`);
  });

  it("competition tabs canonicalise to their own tab URL", () => {
    for (const c of COMPETITIONS) {
      for (const tab of ["fixtures", "table", "scorers", "news"] as const) {
        const { og, canonical } = urls(competitionTabMetadata(c.slug, tab));
        expect(canonical).toBe(`${SITE_URL}/competition/${c.slug}/${tab}`);
        expect(og).toBe(canonical);
      }
    }
  });
});

describe("copy derived from COMPETITIONS (B27)", () => {
  it("lists every competition and never says 'nine'", () => {
    const sentence = competitionListSentence();
    for (const c of COMPETITIONS) {
      const short = c.name.replace(/^UEFA /, "");
      expect(sentence).toContain(short);
    }
    expect(sentence).not.toMatch(/\bnine\b/i);
    expect(competitionStrap().split(" · ")).toHaveLength(COMPETITIONS.length);
  });

  it("count word tracks COMPETITIONS.length", () => {
    expect(competitionCountWord()).toBe(
      ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][
        COMPETITIONS.length
      ] ?? String(COMPETITIONS.length),
    );
  });
});

const MATCH: Match = {
  id: 1528917,
  slug: "germany-serbia-1528917",
  competitionId: 5,
  seasonYear: 2026,
  round: "League A - 3",
  kickoffUtc: "2026-10-10T18:45:00Z",
  status: "finished",
  homeTeamId: 25,
  awayTeamId: 14,
  homeScore: 3,
  awayScore: 1,
  homeTeam: { id: 25, slug: "germany-25", name: "Germany" },
  awayTeam: { id: 14, slug: "serbia-14", name: "Serbia" },
  competition: { id: 5, slug: "nations-league", name: "UEFA Nations League" },
  venueName: "Allianz Arena",
  city: "München",
};

describe("structured data (B19)", () => {
  it("sportsEvent uses organizer, not a SportsOrganization superEvent", () => {
    const ev = sportsEvent(MATCH, "germany-serbia-1528917");
    expect(ev).not.toHaveProperty("superEvent");
    expect(ev.organizer).toMatchObject({ "@type": "SportsOrganization", name: "UEFA Nations League" });
    expect((ev.organizer as { url: string }).url).toBe(`${SITE_URL}/competition/nations-league/table`);
    expect(ev.competitor).toHaveLength(2);
  });

  it("competition crumbs point at the 200 table page, never the redirecting root", () => {
    expect(competitionTableCrumb({ slug: "premier-league", name: "Premier League" })).toEqual([
      { name: "Premier League", path: "/competition/premier-league/table" },
    ]);
    // out-of-scope competitions have no page → no crumb
    expect(competitionTableCrumb({ slug: "brasileirao", name: "Serie A" })).toEqual([]);
  });

  it("breadcrumb items are absolute and contain no /teams index", () => {
    const bc = breadcrumb([
      ...competitionTableCrumb({ slug: "premier-league", name: "Premier League" }),
      { name: "Arsenal", path: "/team/arsenal-42" },
    ]) as { itemListElement: { item: string }[] };
    const items = bc.itemListElement.map((i) => i.item);
    expect(items).toEqual([`${SITE_URL}/competition/premier-league/table`, `${SITE_URL}/team/arsenal-42`]);
    expect(items.some((u) => /\/teams(\/|$)/.test(u))).toBe(false);
  });
});

describe("match share text", () => {
  it("shows the score for a finished match", () => {
    const t = matchShareText(MATCH);
    expect(t.center).toBe("3 – 1");
    expect(t.sub).toBe("Full time");
    expect(matchDescription(MATCH)).toContain("Germany 3–1 Serbia");
  });

  it("shows the UK kickoff time for a scheduled match", () => {
    const t = matchShareText({ ...MATCH, status: "scheduled", homeScore: undefined, awayScore: undefined });
    expect(t.center).toBe("19:45"); // 18:45Z = 19:45 BST
    expect(t.sub).toContain("UK time");
  });

  it("builds the canonical slug the route redirects to", () => {
    expect(canonicalMatchSlug(MATCH, "x-1528917")).toBe("germany-serbia-1528917");
    expect(canonicalMatchSlug({ ...MATCH, homeTeam: undefined }, "x-1528917")).toBe("x-1528917");
  });
});
