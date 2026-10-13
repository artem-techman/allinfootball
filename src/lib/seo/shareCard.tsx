import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { provider } from "@/lib/providers";
import { readArchivedMatch } from "@/lib/db/matchStore";
import { idFromSlug } from "@/lib/utils/slug";
import type { Match, MatchEvent } from "@/lib/providers/types";
import { PIN_DATA_URI, crestDataUri } from "./ogImage";
import { SITE_URL } from "./metadata";
import {
  SHARE_CARD_SIZES,
  cardDateLabel,
  cardFileName,
  clip,
  resultStatusLine,
  scorerSides,
  teamInitials,
  type ScorerLine,
  type ShareCardFormat,
} from "./shareCardData";

/**
 * Result share cards — the image a fan posts to an Instagram story, X, WhatsApp
 * status… (routes: /match/[slug]/card/story 1080x1920, /card/square 1080x1080).
 *
 * One layout, two sizes: a dark striped pitch with faint white markings, the
 * competition + round, both crests and names, the big final score, a gradient
 * status pill, goalscorers under each side, date + venue, and the brand lockup.
 *
 * Rendered with next/og (Satori) like the OG images in ./ogImage.tsx — same
 * default font, every element with children needs `display: flex`.
 */

/* ------------------------------------ response ------------------------------------ */

const IMMUTABLE_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";
/** Used when a part of the card is missing (crest/scorers fetch failed) so a retry can fill it in. */
const PARTIAL_CACHE = "public, s-maxage=300, stale-while-revalidate=3600";

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    // Short: a match that isn't finished yet will be soon.
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, s-maxage=60" },
  });
}

/**
 * Load a finished match (the SAME archive-first lookup as the match page and its
 * OG image — no new provider call patterns) and render its share card. 404 for
 * an unknown id or a match that hasn't finished.
 */
/** Inter, the site's typeface, so the card's wordmark and numbers match the site
 *  (the renderer's built-in font has no bold weight). Read once per instance;
 *  bundled via outputFileTracingIncludes in next.config. */
type CardFont = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: "normal" };
let fontsPromise: Promise<CardFont[]> | null = null;
export function loadCardFonts(): Promise<CardFont[]> {
  fontsPromise ??= Promise.all(
    ([400, 700, 800] as const).map(async (weight) => {
      const buf = await readFile(join(process.cwd(), "src/lib/seo/fonts", `Inter-${weight}.ttf`));
      return { name: "Inter", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" as const };
    }),
  ).catch(() => {
    fontsPromise = null; // retry next time; the card falls back to the default font
    return [];
  });
  return fontsPromise;
}

export async function shareCardResponse(slug: string, format: ShareCardFormat): Promise<Response> {
  const id = idFromSlug(slug);
  if (!id) return notFound();

  const archived = await readArchivedMatch(id);
  const match: Match | undefined = archived?.match ?? (await provider.getMatch(id).catch(() => undefined));
  if (!match || match.status !== "finished" || !match.homeTeam?.name || !match.awayTeam?.name) return notFound();

  const events: MatchEvent[] =
    archived?.details?.events ?? (await provider.getEvents(id).catch(() => [] as MatchEvent[]));

  const [homeCrest, awayCrest] = await Promise.all([
    crestDataUri(match.homeTeam.crest),
    crestDataUri(match.awayTeam.crest),
  ]);

  const goalsScored = (match.homeScore ?? 0) + (match.awayScore ?? 0);
  const hasGoalEvents = events.some((e) => e.type === "goal" || e.type === "penalty" || e.type === "own_goal");
  const complete = Boolean(homeCrest && awayCrest) && (goalsScored === 0 || hasGoalEvents);

  let png: ArrayBuffer;
  try {
    // Render eagerly so a Satori failure is caught here (ImageResponse renders
    // lazily inside the response stream, where it can't be caught).
    png = await renderShareCard({ match, events, format, homeCrest, awayCrest, fonts: await loadCardFonts() }).arrayBuffer();
  } catch {
    try {
      // A crest Satori can't decode is the likeliest culprit — retry with discs.
      png = await renderShareCard({ match, events, format, fonts: await loadCardFonts() }).arrayBuffer();
    } catch {
      return new Response("Card unavailable", { status: 500, headers: { "cache-control": "no-store" } });
    }
  }

  return new Response(png, {
    headers: {
      "content-type": "image/png",
      "content-disposition": `inline; filename="${cardFileName(match, format)}"`,
      "cache-control": complete ? IMMUTABLE_CACHE : PARTIAL_CACHE,
    },
  });
}

/* ------------------------------------- layout ------------------------------------- */

const C = {
  white: "#ffffff",
  dim: "#a8adb5",
  muted: "#8b929c",
  lime: "#d9ff3f",
  ink: "#0a0b0d",
  gradient: "linear-gradient(135deg, #23a455 0%, #5bc850 50%, #d9ff3f 100%)",
};

interface Scale {
  pad: number;
  padTop: number;
  /** Story keeps ~200px clear top and bottom: Instagram/WhatsApp overlay their UI there. */
  padBottom: number;
  comp: number;
  round: number;
  crest: number;
  team: number;
  teamCol: number;
  score: number;
  status: number;
  scorer: number;
  scorerCol: number;
  scorerGap: number;
  meta: number;
  pin: number;
  brand: number;
  domain: number;
  maxScorers: number;
}

const SCALE: Record<ShareCardFormat, Scale> = {
  story: {
    pad: 80,
    padTop: 200,
    padBottom: 190,
    comp: 40,
    round: 32,
    crest: 230,
    team: 50,
    teamCol: 420,
    score: 250,
    status: 32,
    scorer: 34,
    scorerCol: 430,
    scorerGap: 14,
    meta: 30,
    pin: 100,
    brand: 29,
    domain: 26,
    maxScorers: 6,
  },
  square: {
    pad: 60,
    padTop: 64,
    padBottom: 60,
    comp: 30,
    round: 24,
    crest: 150,
    team: 34,
    teamCol: 300,
    score: 150,
    status: 22,
    scorer: 26,
    scorerCol: 440,
    scorerGap: 6,
    meta: 22,
    pin: 64,
    brand: 19,
    domain: 18,
    maxScorers: 5,
  },
};

export interface ShareCardInput {
  match: Match;
  events: MatchEvent[];
  format: ShareCardFormat;
  homeCrest?: string;
  awayCrest?: string;
  fonts?: CardFont[];
}

export function renderShareCard({ match, events, format, homeCrest, awayCrest, fonts = [] }: ShareCardInput): ImageResponse {
  const size = SHARE_CARD_SIZES[format];
  const s = SCALE[format];
  const home = match.homeTeam?.name ?? "Home";
  const away = match.awayTeam?.name ?? "Away";
  const scorers = scorerSides(match, events, s.maxScorers);
  const hasScorers = scorers.home.length > 0 || scorers.away.length > 0;
  const competition = (match.competition?.name ?? "Football").toUpperCase();
  const meta = [cardDateLabel(match.kickoffUtc), match.venueName && clip(match.venueName, 40)]
    .filter(Boolean)
    .join("  ·  ");

  const teams =
    format === "story" ? (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <TeamBlock name={home} crest={homeCrest} s={s} />
          <TeamBlock name={away} crest={awayCrest} s={s} />
        </div>
        <Score match={match} s={s} />
        <StatusPill match={match} s={s} />
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <TeamBlock name={home} crest={homeCrest} s={s} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Score match={match} s={s} />
          <StatusPill match={match} s={s} />
        </div>
        <TeamBlock name={away} crest={awayCrest} s={s} />
      </div>
    );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#08090c",
          color: C.white,
          fontFamily: fonts.length ? "Inter" : "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pitchDataUri(size.width, size.height)}
          width={size.width}
          height={size.height}
          alt=""
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        {/* legibility vignette + a soft brand glow behind the score */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 50% 46%, rgba(91,200,80,0.20) 0%, rgba(8,9,12,0) 45%), linear-gradient(180deg, rgba(8,9,12,0.55) 0%, rgba(8,9,12,0.15) 30%, rgba(8,9,12,0.15) 70%, rgba(8,9,12,0.80) 100%)",
          }}
        />
        {/* brand gradient bar */}
        <div
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 12, display: "flex", backgroundImage: C.gradient }}
        />

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: `${s.padTop}px ${s.pad}px ${s.padBottom}px`,
          }}
        >
          {/* competition + round */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: s.comp, fontWeight: 700, letterSpacing: 4, color: C.lime, textAlign: "center" }}>
              {clip(competition, format === "story" ? 34 : 44)}
            </div>
            {match.round && (
              <div style={{ display: "flex", marginTop: 10, fontSize: s.round, color: C.dim, textAlign: "center" }}>
                {clip(match.round, 48)}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              width: "100%",
            }}
          >
            {teams}
            {hasScorers && <Scorers sides={scorers} s={s} />}
          </div>

          {/* date + venue, then the brand lockup */}
          {meta && (
            <div style={{ display: "flex", fontSize: s.meta, color: C.muted, textAlign: "center" }}>{meta}</div>
          )}
          {/* The brand lockup exactly as in the site header: pin, thin divider,
              "MY / FOOTBALL / TRACKER" stacked in Inter ExtraBold. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: format === "story" ? 40 : 22 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PIN_DATA_URI} width={s.pin} height={s.pin} alt="" />
              <div
                style={{
                  display: "flex",
                  width: 2,
                  height: Math.round(s.pin * 0.82),
                  marginLeft: Math.round(s.pin * 0.3),
                  marginRight: Math.round(s.pin * 0.3),
                  background: "rgba(255,255,255,0.18)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: s.brand,
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: 0.4,
                  color: C.white,
                }}
              >
                <div style={{ display: "flex" }}>MY</div>
                <div style={{ display: "flex" }}>FOOTBALL</div>
                <div style={{ display: "flex" }}>TRACKER</div>
              </div>
            </div>
            <div style={{ display: "flex", marginTop: Math.round(s.pin * 0.28), fontSize: s.domain, color: C.lime }}>
              {SITE_URL.replace(/^https?:\/\//, "")}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}

function TeamBlock({ name, crest, s }: { name: string; crest?: string; s: Scale }) {
  const long = name.length > 16;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: s.teamCol }}>
      {crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={crest} width={s.crest} height={s.crest} alt="" style={{ objectFit: "contain" }} />
      ) : (
        <div
          style={{
            width: s.crest,
            height: s.crest,
            borderRadius: s.crest / 2,
            background: "#1a1c22",
            border: "4px solid rgba(255,255,255,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(s.crest * 0.36),
            fontWeight: 800,
            color: "#cbd2da",
          }}
        >
          {teamInitials(name)}
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: Math.round(s.crest * 0.12),
          fontSize: long ? Math.round(s.team * 0.8) : s.team,
          fontWeight: 800,
          lineHeight: 1.12,
          textAlign: "center",
        }}
      >
        {clip(name, 28)}
      </div>
    </div>
  );
}

function Score({ match, s }: { match: Match; s: Scale }) {
  const digit = { display: "flex", justifyContent: "center", minWidth: s.score * 0.62 } as const;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginTop: s.score > 200 ? 30 : 0,
        fontSize: s.score,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: -4,
      }}
    >
      <div style={digit}>{match.homeScore ?? "-"}</div>
      <div style={{ display: "flex", color: "rgba(255,255,255,0.45)", margin: `0 ${Math.round(s.score * 0.08)}px` }}>–</div>
      <div style={digit}>{match.awayScore ?? "-"}</div>
    </div>
  );
}

function StatusPill({ match, s }: { match: Match; s: Scale }) {
  return (
    <div
      style={{
        display: "flex",
        marginTop: Math.round(s.status * 0.9),
        padding: `${Math.round(s.status * 0.42)}px ${Math.round(s.status * 1.1)}px`,
        borderRadius: 999,
        backgroundImage: C.gradient,
        color: C.ink,
        fontSize: s.status,
        fontWeight: 800,
        letterSpacing: 3,
      }}
    >
      {resultStatusLine(match)}
    </div>
  );
}

function Scorers({ sides, s }: { sides: ReturnType<typeof scorerSides>; s: Scale }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", width: "100%", marginTop: Math.round(s.scorer * 1.6) }}>
      <ScorerColumn lines={sides.home} more={sides.homeMore} align="right" s={s} />
      <div style={{ display: "flex", width: 2, margin: `0 ${Math.round(s.scorer * 0.9)}px`, background: "rgba(255,255,255,0.16)" }} />
      <ScorerColumn lines={sides.away} more={sides.awayMore} align="left" s={s} />
    </div>
  );
}

function ScorerColumn({ lines, more, align, s }: { lines: ScorerLine[]; more: number; align: "left" | "right"; s: Scale }) {
  const justify = align === "right" ? "flex-end" : "flex-start";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: justify, width: s.scorerCol }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: justify,
            marginTop: i === 0 ? 0 : s.scorerGap,
            fontSize: s.scorer,
            lineHeight: 1.2,
          }}
        >
          <div style={{ display: "flex", color: C.white, fontWeight: 700, marginRight: 10 }}>{clip(l.name, 22)}</div>
          <div style={{ display: "flex", color: C.dim }}>{l.minutes}</div>
        </div>
      ))}
      {more > 0 && (
        <div style={{ display: "flex", marginTop: s.scorerGap, fontSize: Math.round(s.scorer * 0.85), color: C.muted }}>
          +{more} more
        </div>
      )}
    </div>
  );
}

/* ------------------------------------- pitch ------------------------------------- */

/**
 * A vertical football pitch as an SVG data URI: dark green mowing stripes and thin
 * semi-transparent white markings (touchlines, halfway line, centre circle,
 * penalty + goal areas, penalty arcs and spots, corner arcs). Proportions follow
 * a 68 x 105 m pitch, stretched to the canvas.
 */
export function pitchDataUri(width: number, height: number): string {
  const m = Math.round(width * 0.045); // margin to the touchline
  const x0 = m;
  const y0 = m;
  const pw = width - 2 * m;
  const ph = height - 2 * m;
  const cx = width / 2;
  const cy = height / 2;
  const u = pw / 68; // metres → px across the pitch
  const v = ph / 105; // metres → px along the pitch
  const stroke = `stroke="rgba(255,255,255,0.13)" stroke-width="3" fill="none"`;

  const stripes = height > width ? 14 : 10;
  const band = height / stripes;
  let bands = "";
  for (let i = 0; i < stripes; i += 2) {
    bands += `<rect x="0" y="${(i * band).toFixed(1)}" width="${width}" height="${band.toFixed(1)}" fill="rgba(255,255,255,0.028)"/>`;
  }

  const boxW = 40.3 * u;
  const boxD = 16.5 * v;
  const goalW = 18.3 * u;
  const goalD = 5.5 * v;
  const spot = 11 * v;
  const arcR = 9.15 * u;
  const circleR = 9.15 * u;
  const corner = 1.5 * u;

  // The penalty arc is the part of the 9.15 m circle around the spot outside the box.
  const arcDy = boxD - spot; // spot → box edge
  const arcDx = Math.sqrt(Math.max(0, arcR * arcR - arcDy * arcDy));
  const ends = (top: boolean) => {
    const yEdge = top ? y0 + boxD : y0 + ph - boxD;
    const sweep = top ? 0 : 1;
    return `<path d="M ${(cx - arcDx).toFixed(1)} ${yEdge.toFixed(1)} A ${arcR.toFixed(1)} ${arcR.toFixed(1)} 0 0 ${sweep} ${(cx + arcDx).toFixed(1)} ${yEdge.toFixed(1)}" ${stroke}/>`;
  };
  const area = (top: boolean) => {
    const by = top ? y0 : y0 + ph - boxD;
    const gy = top ? y0 : y0 + ph - goalD;
    const sy = top ? y0 + spot : y0 + ph - spot;
    return (
      `<rect x="${(cx - boxW / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxD.toFixed(1)}" ${stroke}/>` +
      `<rect x="${(cx - goalW / 2).toFixed(1)}" y="${gy.toFixed(1)}" width="${goalW.toFixed(1)}" height="${goalD.toFixed(1)}" ${stroke}/>` +
      `<circle cx="${cx}" cy="${sy.toFixed(1)}" r="5" fill="rgba(255,255,255,0.18)"/>` +
      ends(top)
    );
  };
  const corners =
    `<path d="M ${x0 + corner} ${y0} A ${corner} ${corner} 0 0 1 ${x0} ${y0 + corner}" ${stroke}/>` +
    `<path d="M ${x0 + pw - corner} ${y0} A ${corner} ${corner} 0 0 0 ${x0 + pw} ${y0 + corner}" ${stroke}/>` +
    `<path d="M ${x0} ${y0 + ph - corner} A ${corner} ${corner} 0 0 1 ${x0 + corner} ${y0 + ph}" ${stroke}/>` +
    `<path d="M ${x0 + pw} ${y0 + ph - corner} A ${corner} ${corner} 0 0 0 ${x0 + pw - corner} ${y0 + ph}" ${stroke}/>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><radialGradient id="g" cx="50%" cy="48%" r="75%"><stop offset="0%" stop-color="#103d22"/><stop offset="55%" stop-color="#0b2416"/><stop offset="100%" stop-color="#07100b"/></radialGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#g)"/>` +
    bands +
    `<rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" ${stroke}/>` +
    `<line x1="${x0}" y1="${cy}" x2="${x0 + pw}" y2="${cy}" stroke="rgba(255,255,255,0.13)" stroke-width="3"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${circleR.toFixed(1)}" ${stroke}/>` +
    `<circle cx="${cx}" cy="${cy}" r="6" fill="rgba(255,255,255,0.18)"/>` +
    area(true) +
    area(false) +
    corners +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
