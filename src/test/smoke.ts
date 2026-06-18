/**
 * Smoke test (CLAUDE.md sections 14 + 16). Hits our OWN /api routes against a
 * running dev/preview server (default http://localhost:3000, override with
 * SMOKE_BASE_URL) and prints pass/fail. Covers a Premier League fixture + match
 * detail, a World Cup group (standings), and the news pipeline.
 *
 * Run: npm run dev (in one shell), then `npm run smoke`.
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function getJson(path: string): Promise<{ res: Response; body: Record<string, unknown> }> {
  const res = await fetch(BASE + path, { cache: "no-store" });
  const body = (await res.json()) as Record<string, unknown>;
  return { res, body };
}

function check(name: string, ok: boolean, detail: string): Check {
  return { name, ok, detail };
}

async function run(): Promise<Check[]> {
  const checks: Check[] = [];

  // 1. Live fixtures route
  try {
    const { res, body } = await getJson("/api/live");
    checks.push(check("live route", res.ok, body.delayed ? "200 (degraded — healthy)" : "200 OK"));
  } catch (e) {
    checks.push(check("live route", false, msg(e)));
  }

  // 2. Premier League fixtures + 3. a match detail derived from them
  let plFixtureId: number | undefined;
  try {
    const { res, body } = await getJson("/api/fixtures?league=39&season=2025");
    const matches = (body.matches as { id: number }[]) ?? [];
    plFixtureId = matches[0]?.id;
    checks.push(check("PL fixtures route", res.ok && matches.length > 0, `${matches.length} fixtures`));
  } catch (e) {
    checks.push(check("PL fixtures route", false, msg(e)));
  }

  if (plFixtureId) {
    try {
      const { res, body } = await getJson(`/api/match?id=${plFixtureId}`);
      const hasMatch = Boolean(body.match);
      checks.push(check("PL match detail route", res.ok && hasMatch, hasMatch ? `fixture ${plFixtureId}` : "no match"));
    } catch (e) {
      checks.push(check("PL match detail route", false, msg(e)));
    }
  }

  // 4. World Cup group standings
  try {
    const { res, body } = await getJson("/api/standings?league=1&season=2026");
    const rows = (body.standings as { groupLabel: string | null }[]) ?? [];
    const grouped = new Set(rows.map((r) => r.groupLabel)).size > 1;
    checks.push(check("World Cup group standings", res.ok && rows.length > 0, grouped ? `${rows.length} rows, grouped` : `${rows.length} rows`));
  } catch (e) {
    checks.push(check("World Cup group standings", false, msg(e)));
  }

  // 5. News pipeline
  try {
    const { res, body } = await getJson("/api/news?limit=5");
    const articles = (body.articles as unknown[]) ?? [];
    checks.push(check("news route", res.ok && articles.length > 0, `${articles.length} articles`));
  } catch (e) {
    checks.push(check("news route", false, msg(e)));
  }

  return checks;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "fetch failed (is the server running?)";
}

async function main() {
  const checks = await run();
  let allOk = true;
  for (const c of checks) {
    if (!c.ok) allOk = false;
    // eslint-disable-next-line no-console
    console.log(`[${c.ok ? "PASS" : "FAIL"}] ${c.name} — ${c.detail}`);
  }
  // eslint-disable-next-line no-console
  console.log(allOk ? "\nSMOKE: PASS" : "\nSMOKE: FAIL");
  process.exit(allOk ? 0 : 1);
}

void main();
