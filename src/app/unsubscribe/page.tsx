import { AppShell } from "@/components/shell/AppShell";
import { unsubscribeByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

/**
 * Unsubscribe from matchday emails. Uses a confirm button (a form POST to this
 * page's server action) rather than unsubscribing on GET, so link scanners in
 * mail clients can't unsubscribe people by "visiting" the link.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token = "", done } = await searchParams;

  async function confirm(form: FormData) {
    "use server";
    const { redirect } = await import("next/navigation");
    const ok = await unsubscribeByToken(String(form.get("token") ?? "")).catch(() => false);
    redirect(`/unsubscribe?done=${ok ? "1" : "0"}`);
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-md rounded-card border border-hairline bg-card p-card text-center">
        <h1 className="text-section text-text-primary">Matchday emails</h1>
        {done === "1" ? (
          <p className="mt-3 text-meta text-text-secondary">You&apos;re unsubscribed. You can switch them back on from My Club any time.</p>
        ) : done === "0" ? (
          <p className="mt-3 text-meta text-text-secondary">That link didn&apos;t work. You can manage emails from My Club.</p>
        ) : (
          <form action={confirm} className="mt-4">
            <input type="hidden" name="token" value={token} />
            <p className="mb-4 text-meta text-text-secondary">Stop sending me matchday emails?</p>
            <button type="submit" className="rounded-tile bg-accent-gradient px-5 py-2.5 text-meta font-bold text-text-on-accent">
              Unsubscribe
            </button>
          </form>
        )}
      </section>
    </AppShell>
  );
}
