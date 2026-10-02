import { siteImageResponse } from "@/lib/seo/ogImage";

export const alt = "My Football Tracker — Live scores, tables & match stats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social / search share image (og:image + twitter:image fallback). */
export default function OpengraphImage() {
  return siteImageResponse();
}
