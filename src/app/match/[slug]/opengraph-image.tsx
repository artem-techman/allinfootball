import { ImageResponse } from "next/og";
import { provider } from "@/lib/providers";
import { readArchivedMatch } from "@/lib/db/matchStore";
import { idFromSlug } from "@/lib/utils/slug";
import { matchShareText } from "@/lib/seo/matchShare";
import { OG_BACKGROUND, OG_SIZE, PIN_DATA_URI, siteImageResponse } from "@/lib/seo/ogImage";
import { SITE_NAME } from "@/lib/seo/metadata";
import type { Match } from "@/lib/providers/types";

export const alt = "Match card — My Football Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Per-match share card (B6): competition, both teams (+ crests), and the score
 * or the kickoff time. Uses the SAME lookups as the match page (archive first,
 * then the swr-cached provider.getMatch), so a share adds no extra quota. Any
 * failure — unknown id, provider down, a crest that won't load, a render
 * error — falls back to the site-wide share image.
 */
export default async function MatchOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  try {
    const { slug } = await params;
    const id = idFromSlug(slug);
    if (!id) return siteImageResponse();
    const archived = await readArchivedMatch(id);
    const match: Match | undefined = archived?.match ?? (await provider.getMatch(id).catch(() => undefined));
    if (!match?.homeTeam?.name || !match.awayTeam?.name) return siteImageResponse();

    const [homeCrest, awayCrest] = await Promise.all([
      crestDataUri(match.homeTeam.crest),
      crestDataUri(match.awayTeam.crest),
    ]);
    const card = renderCard(match, homeCrest, awayCrest);
    // Render eagerly so a Satori failure is caught here (ImageResponse renders
    // lazily inside the response stream, where it can't be caught).
    const png = await card.arrayBuffer();
    return new Response(png, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    return siteImageResponse();
  }
}

/** Fetch a crest and inline it; undefined on any problem (card renders without it). */
async function crestDataUri(url: string | undefined): Promise<string | undefined> {
  if (!url || !/^https:\/\//.test(url)) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), next: { revalidate: 86_400 } });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpeg|gif|webp)/.test(type)) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 512_000) return undefined;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function TeamBlock({ name, crest }: { name: string; crest?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 330 }}>
      {crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={crest} width={150} height={150} alt="" style={{ objectFit: "contain" }} />
      ) : (
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 75,
            background: "#1a1c20",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 800,
            color: "#cbd2da",
          }}
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div
        style={{
          marginTop: 26,
          fontSize: name.length > 18 ? 38 : 46,
          fontWeight: 800,
          textAlign: "center",
          lineHeight: 1.1,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {name}
      </div>
    </div>
  );
}

function renderCard(match: Match, homeCrest?: string, awayCrest?: string): ImageResponse {
  const t = matchShareText(match);
  const header = t.round ? `${t.competition} · ${t.round}` : t.competition;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: OG_BACKGROUND,
          color: "#ffffff",
          padding: "48px 70px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#d9ff3f" }}>
            {header.length > 60 ? `${header.slice(0, 57)}…` : header}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PIN_DATA_URI} width={44} height={44} alt="" />
            <div style={{ fontSize: 26, fontWeight: 700, color: "#cbd2da" }}>{SITE_NAME}</div>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between" }}>
          <TeamBlock name={t.home} crest={homeCrest} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 108, fontWeight: 800, letterSpacing: -2 }}>{t.center}</div>
            <div style={{ display: "flex", marginTop: 8, fontSize: 28, color: "#a8adb5" }}>{t.sub}</div>
          </div>
          <TeamBlock name={t.away} crest={awayCrest} />
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
