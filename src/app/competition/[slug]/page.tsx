import { redirect } from "next/navigation";

/** Competition hub index → default to the Table view. */
export default async function CompetitionIndex({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/competition/${slug}/table`);
}
