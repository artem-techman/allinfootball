import { redirect } from "next/navigation";

/**
 * Competition hub index → default to the Table view. Deliberately a temporary
 * (307) redirect, not permanentRedirect(): this is a default-tab choice, not a
 * canonical slug fix, and the roadmap (X6) turns this URL into a real overview
 * page — a browser-cached 308 would keep sending past visitors to /table.
 * Breadcrumbs and internal links point straight at /table instead (B19).
 */
export default async function CompetitionIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/competition/${slug}/table`);
}
