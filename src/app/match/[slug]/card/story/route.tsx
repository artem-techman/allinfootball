import { shareCardResponse } from "@/lib/seo/shareCard";

/**
 * Result share card, story format (1080x1920, for Instagram/TikTok stories and
 * WhatsApp status). Finished matches only
 * (404 otherwise); immutable, so the CDN keeps it for a day. Layout and loading
 * live in src/lib/seo/shareCard.tsx.
 */
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return shareCardResponse(slug, "story");
}
