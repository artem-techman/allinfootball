import type { Metadata } from "next";

/**
 * Per-route metadata builder (B6). Every route's `metadata` / `generateMetadata`
 * goes through here so share previews (WhatsApp, iMessage, X, Slack…) show the
 * page that was shared — not the homepage. Next merges route metadata over the
 * root layout SHALLOWLY: a route that sets no `openGraph` inherits the root's
 * homepage og:url/og:title, which is exactly the bug this fixes.
 *
 * Contract (tested in src/test/seo-metadata.test.ts):
 *  - og:url === canonical === absolute URL on SITE_URL
 *  - og:site_name is always SITE_NAME
 *  - twitter card is summary_large_image
 */

export const SITE_URL = "https://myfootballtracker.com";
export const SITE_NAME = "My Football Tracker";

/** The site-wide share image (src/app/opengraph-image.tsx). */
export const SITE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "My Football Tracker — Live scores, tables & match stats",
} as const;

/** Absolute URL on the production origin for a site path ("/match/x-1"). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = `/${path.replace(/^\/+/, "")}`;
  // The root is the bare origin (no trailing slash), matching metadataBase.
  return clean === "/" ? SITE_URL : `${SITE_URL}${clean.replace(/\/+$/, "")}`;
}

export interface BuildMetadataInput {
  title: string;
  description: string;
  /** Site path of the canonical URL, e.g. "/team/arsenal-42". */
  path: string;
  /**
   * Share image. Omit for the site image. Pass `"file"` when the route segment
   * has its own `opengraph-image.tsx` — Next only applies a file-based image when
   * the route's openGraph object has NO `images` key, so we must leave it out.
   */
  image?: string | "file";
  /** og:type — "website" unless the page is an article. */
  type?: "website" | "article";
  /** Use the title verbatim (skip the "%s · My Football Tracker" template). */
  absoluteTitle?: boolean;
  robots?: Metadata["robots"];
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const canonical = absoluteUrl(input.path);
  const openGraph: NonNullable<Metadata["openGraph"]> = {
    url: canonical,
    title: input.title,
    description: input.description,
    siteName: SITE_NAME,
    type: input.type ?? "website",
    locale: "en_GB",
  };
  if (input.image !== "file") {
    openGraph.images = input.image ? [{ url: input.image }] : [{ ...SITE_IMAGE }];
  }
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical },
    openGraph,
    // No `images` key: Next fills twitter:image from og:image (incl. file-based).
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
    ...(input.robots ? { robots: input.robots } : {}),
  };
}
