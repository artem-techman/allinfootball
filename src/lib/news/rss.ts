import "server-only";

import { slugify } from "@/lib/utils/slug";

/**
 * Minimal dependency-free RSS 2.0 parser tuned for our three feeds (BBC,
 * Guardian, Sky). Extracts headline, dek (HTML stripped), link, publish time and
 * an image from media:thumbnail / media:content / enclosure. Body is never
 * captured — v1 is link-out only (CLAUDE.md section 11). This is parsing of
 * untrusted external XML, so it is defensive and unit-tested.
 */

export interface RawNewsItem {
  title: string;
  dek: string;
  link: string;
  image?: string;
  publishedAtUtc: string;
  sourceName: string;
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
  "&#160;": " ",
};

function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m] ?? m);
}

function unwrapCdata(input: string): string {
  const m = input.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : input;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ");
}

function clean(input: string | undefined): string {
  if (!input) return "";
  // Decode entities FIRST so encoded markup (e.g. Guardian's &lt;p&gt;) becomes
  // real tags, then strip those tags, then decode once more for any revealed
  // entities. Order matters — stripping before decoding leaves visible <p>.
  let s = decodeEntities(unwrapCdata(input));
  s = decodeEntities(stripTags(s));
  return s.replace(/\s+/g, " ").trim();
}

/** Pull the inner text of the first matching tag (namespace-aware, attrs ok). */
function tag(block: string, name: string): string | undefined {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i");
  return block.match(re)?.[1];
}

/** Pull an attribute (e.g. url) from the first self-closing/opening tag. */
function attr(block: string, name: string, attribute: string): string | undefined {
  const re = new RegExp(`<${name}\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i");
  return block.match(re)?.[1];
}

function toIso(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function extractImage(block: string): string | undefined {
  return (
    attr(block, "media:thumbnail", "url") ??
    attr(block, "media:content", "url") ??
    attr(block, "enclosure", "url") ??
    attr(block, "img", "src")
  );
}

/** Parse one feed's XML string into raw news items (drops malformed entries). */
export function parseFeed(xml: string, sourceName: string): RawNewsItem[] {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const items: RawNewsItem[] = [];
  for (const block of blocks) {
    const title = clean(tag(block, "title"));
    // Atom uses <link href="...">; RSS uses <link>text</link>.
    const link = clean(tag(block, "link")) || attr(block, "link", "href") || "";
    if (!title || !link) continue;
    const descRaw = tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content:encoded");
    const dek = clean(descRaw).slice(0, 220);
    const dateRaw = tag(block, "pubDate") ?? tag(block, "dc:date") ?? tag(block, "published") ?? tag(block, "updated");
    items.push({
      title,
      dek,
      link,
      image: extractImage(block),
      publishedAtUtc: toIso(dateRaw && clean(dateRaw)),
      sourceName,
    });
  }
  return items;
}

/** Fetch + parse a single feed. Returns [] on any network/parse failure. */
export async function fetchFeed(url: string, sourceName: string): Promise<RawNewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "goodfootballcompany-news-bot/1.0", accept: "application/rss+xml, application/xml, text/xml" },
      // Durable cross-instance cache (5 min) so each RSS feed is pulled once per
      // window for all visitors, not on every render.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), sourceName);
  } catch {
    return [];
  }
}

/** Stable id/slug for an article (used for dedupe + /news/[slug]). */
export function articleSlug(title: string): string {
  return slugify(title).slice(0, 80);
}
