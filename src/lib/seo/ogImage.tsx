import { ImageResponse } from "next/og";
import { SITE_NAME } from "./metadata";
import { competitionStrap } from "./copy";

/**
 * Shared pieces of the share images (opengraph-image.tsx files). Rendered with
 * next/og's ImageResponse (Satori), so every element with children needs an
 * explicit `display: flex`.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const PIN = `<svg width="240" height="240" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#23A455"/><stop offset="50%" stop-color="#5BC850"/><stop offset="100%" stop-color="#D9FF3F"/></linearGradient></defs><path d="M50 7C29.7 7 13 23.7 13 44C13 67 41 84 50 95C59 84 87 67 87 44C87 23.7 70.3 7 50 7Z" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-width="5"><circle cx="50" cy="43" r="23"/><line x1="50" y1="20" x2="50" y2="66" stroke-linecap="round"/></g><circle cx="50" cy="43" r="7.5" fill="url(#g)" stroke="#fff" stroke-width="4.5"/></svg>`;

/** The BallMark pin as a data URI (no network fetch at render time). */
export const PIN_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(PIN).toString("base64")}`;

/** Fetch a crest and inline it; undefined on any problem (card renders without it). */
export async function crestDataUri(url: string | undefined): Promise<string | undefined> {
  if (!url || !/^https:\/\//.test(url)) return undefined;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), next: { revalidate: 86_400 } });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpeg|gif|webp)/.test(type)) return undefined;
    let buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 512_000) return undefined;
    // Trust the bytes, not the header: the provider serves some national flags
    // as GIF labelled image/png, and the card renderer can't draw GIF/WebP — it
    // silently left Cyprus's crest blank. Convert anything that isn't PNG/JPEG.
    const kind = imageKind(buf);
    if (kind === "unknown") return undefined;
    if (kind === "gif" || kind === "webp") {
      const converted = await toPng(buf);
      if (!converted) return undefined;
      buf = converted;
    }
    const mime = kind === "jpeg" ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** Sniff the real image format from its first bytes. Exported for tests. */
export function imageKind(buf: Buffer): "png" | "jpeg" | "gif" | "webp" | "unknown" {
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 6 && buf.subarray(0, 3).toString("ascii") === "GIF") return "gif";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return "unknown";
}

async function toPng(buf: Buffer): Promise<Buffer | undefined> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(buf).png().toBuffer();
  } catch {
    return undefined;
  }
}

export const OG_BACKGROUND = "radial-gradient(900px 600px at 78% 30%, #14361f 0%, #08090c 60%)";

/** The site-wide share card (brand, tagline, competition strap). */
export function siteImageResponse(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: OG_BACKGROUND,
          color: "#ffffff",
          padding: "0 90px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PIN_DATA_URI} width={150} height={150} alt="" />
          <div style={{ fontSize: 70, fontWeight: 800, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>
        <div style={{ marginTop: 28, fontSize: 40, color: "#cbd2da" }}>
          Live scores · tables · fixtures · lineups · stats
        </div>
        <div style={{ marginTop: 16, fontSize: 25, color: "#8b929c", display: "flex", flexWrap: "wrap" }}>
          {competitionStrap()}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
