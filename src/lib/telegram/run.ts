import "server-only";
import { provider } from "@/lib/providers";
import { readyDb } from "@/lib/db/neon";
import { getNews } from "@/lib/news";
import { highlights } from "@/lib/highlights";
import { todayKey, shiftDateKey } from "@/lib/utils/date";
import type { Match } from "@/lib/providers/types";
import { getCompetitionBySlug } from "@/lib/constants/competitions";
import { seasonYearFor } from "@/lib/season";
import { groupRounds } from "@/lib/seo/rounds";
import { postPhoto, postText, postVideoLink } from "./index";
import {
  SITE,
  disallowedMessage,
  goalMessage,
  highlightMessage,
  isImportant,
  newsMessage,
  newsScore,
  resultCaption,
  roundMessage,
  sameStory,
  storyWords,
  todayMessage,
} from "./curation";

/**
 * One run of the channel bot (cron every minute once Vercel Pro is on; every
 * task is idempotent, so any cadence works). Tasks, in priority order:
 *   goals     important live matches; a score is posted only once two runs agree
 *             (≥45s apart); a score that drops gets a "goal ruled out" post
 *   results   full time for important matches: the square share card + scorers
 *   today     07:00–11:00 UK, once a day: today's important fixtures
 *   highlights official clip for important finished matches (≤48h)
 *   rounds    a big competition's round just finished: every score + round-up link
 *   news      the single best fresh story per run, at most 5 a day
 * Every post is claimed in telegram_posts BEFORE sending (at most once; a
 * failed send may be retried up to 3 times).
 */

type Sql = NonNullable<Awaited<ReturnType<typeof readyDb>>>;

/** Competitions whose completed rounds get a results post. */
const ROUND_COMPS = ["premier-league", "la-liga", "serie-a", "bundesliga", "ligue-1", "champions-league", "europa-league"];

export interface RunReport {
  posted: string[];
  skipped: string[];
  errors: string[];
}

export async function runTelegram(): Promise<RunReport> {
  const sql = await readyDb(8_000);
  if (!sql) throw new Error("database unavailable");
  const report: RunReport = { posted: [], skipped: [], errors: [] };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      report.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const today = todayKey();
  const days = await Promise.all([shiftDateKey(today, -1), today].map((d) => provider.getFixturesByDate(d).catch(() => [] as Match[])));
  const fixtures = days.flat().filter(isImportant);
  const now = Date.now();

  await step("goals", () => goals(sql, fixtures, report));

  await step("results", async () => {
    const done = fixtures.filter((m) => m.status === "finished" && now - Date.parse(m.kickoffUtc) < 8 * 3600_000);
    for (const m of done) {
      const events = await provider.getEvents(m.id).catch(() => []);
      await post(sql, `result:${m.id}`, "result", report, () =>
        postPhoto(`${SITE}/match/${m.slug}/card/square`, resultCaption(m, events)),
      );
    }
  });

  await step("today", async () => {
    const hourUk = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(new Date()));
    if (hourUk < 7 || hourUk >= 11) return;
    const todays = fixtures.filter((m) => m.status === "scheduled" && m.kickoffUtc >= new Date(now - 3600_000).toISOString() && todayKey() === today);
    if (!todays.length) return;
    await post(sql, `today:${today}`, "today", report, () => postText(todayMessage(todays)));
  });

  await step("highlights", async () => {
    const recent = fixtures.filter((m) => m.status === "finished" && now - Date.parse(m.kickoffUtc) < 48 * 3600_000);
    let lookups = 0;
    for (const m of recent) {
      if (lookups >= 3) break; // YouTube quota: a few searches per run
      if (await alreadyPosted(sql, `highlight:${m.id}`)) continue;
      lookups += 1;
      const h = await highlights
        .getMatchHighlight({ home: m.homeTeam?.name ?? "", away: m.awayTeam?.name ?? "", dateIso: m.kickoffUtc, competitionSlug: m.competition?.slug })
        .catch(() => undefined);
      if (!h) continue;
      const events = await provider.getEvents(m.id).catch(() => []);
      await post(sql, `highlight:${m.id}`, "highlight", report, () => postVideoLink(h.watchUrl, highlightMessage(m, h.watchUrl, events)));
    }
  });

  await step("rounds", async () => {
    for (const slug of ROUND_COMPS) {
      const comp = getCompetitionBySlug(slug);
      if (!comp) continue;
      // The saved season list (cached for 30 min): no extra provider cost per run.
      const season = await provider.getFixturesByLeague(comp.leagueId, seasonYearFor(comp)).catch(() => [] as Match[]);
      for (const r of groupRounds(slug, season)) {
        if (r.state !== "complete" || now - Date.parse(r.endUtc) > 24 * 3600_000) continue;
        // Last kick-off + ~2h15: the final whistle of the round's last game has gone.
        if (now - Date.parse(r.endUtc) < 135 * 60_000) continue;
        const url = `${SITE}/competition/${slug}/round/${r.slug}`;
        await post(sql, `round:${slug}:${r.slug}:${seasonYearFor(comp)}`, "round", report, () => postText(roundMessage(comp.name, r.label, r.matches, url)));
      }
    }
  });

  await step("news", async () => {
    const todayNews = (await sql`select count(*)::int as n from telegram_posts where kind = 'news' and status = 'sent' and posted_at > now() - interval '24 hours'`) as { n: number }[];
    if ((todayNews[0]?.n ?? 0) >= 5) return;
    const stories = (await getNews({ limit: 30 }).catch(() => [])).map((a) => ({ a, score: newsScore(a) })).filter((x) => x.score >= 3);
    stories.sort((x, y) => y.score - x.score);
    // Skip the same story from another outlet (e.g. BBC and Sky on one press conference).
    const recent = (await sql`select key from telegram_posts where kind = 'news' and posted_at > now() - interval '24 hours'`) as { key: string }[];
    const recentWords = recent.map((r) => storyWords(r.key.slice("news:".length)));
    for (const { a } of stories) {
      if (await alreadyPosted(sql, `news:${a.slug}`)) continue;
      const words = storyWords(a.title);
      if (recentWords.some((w) => sameStory(words, w))) continue;
      await post(sql, `news:${a.slug}`, "news", report, () => postText(newsMessage(a), true));
      break; // one story per run keeps the channel paced
    }
  });

  return report;
}

/** Goals for important live matches, confirmed across two runs; drops → correction. */
async function goals(sql: Sql, fixtures: Match[], report: RunReport) {
  const importantIds = new Set(fixtures.map((m) => m.id));
  const live = (await provider.getLiveFixtures().catch(() => [] as Match[])).filter((m) => importantIds.has(m.id) || isImportant(m));
  for (const m of live) {
    const score = `${m.homeScore ?? 0}-${m.awayScore ?? 0}`;
    const total = (m.homeScore ?? 0) + (m.awayScore ?? 0);
    // Highest score we've already announced for this match.
    const posted = (await sql`select key from telegram_posts where kind = 'goal' and status = 'sent' and key like ${`goal:${m.id}:%`}`) as { key: string }[];
    const announced = Math.max(-1, ...posted.map((r) => r.key.split(":")[2].split("-").map(Number).reduce((a, b) => a + b, 0)));
    if (announced > total) {
      await post(sql, `disallowed:${m.id}:${score}`, "disallowed", report, () => postText(disallowedMessage(m)));
      continue;
    }
    if (total === 0 || announced >= total) continue;
    // First sighting only records it; the next run (≥45s later) confirms and posts.
    const seen = (await sql`
      insert into telegram_posts (key, kind, status) values (${`seen:${m.id}:${score}`}, 'seen', 'seen')
      on conflict (key) do update set attempts = telegram_posts.attempts
      returning posted_at, (xmax = 0) as inserted
    `) as { posted_at: string; inserted: boolean }[];
    if (seen[0]?.inserted || Date.now() - Date.parse(seen[0]!.posted_at) < 45_000) {
      report.skipped.push(`goal ${m.id} ${score}: awaiting confirmation`);
      continue;
    }
    const events = await provider.getEvents(m.id).catch(() => []);
    const goalEvents = events.filter((e) => e.type === "goal" || e.type === "penalty" || e.type === "own_goal");
    // The score often updates before the provider names the scorer: wait up to
    // ~3 minutes for the goal event, then post without a name rather than not at all.
    const waitedMs = Date.now() - Date.parse(seen[0]!.posted_at);
    if (goalEvents.length < total && waitedMs < 3 * 60_000) {
      report.skipped.push(`goal ${m.id} ${score}: waiting for the scorer`);
      continue;
    }
    const lastGoal = goalEvents[goalEvents.length - 1];
    await post(sql, `goal:${m.id}:${score}`, "goal", report, () => postText(goalMessage(m, lastGoal)));
  }
}

async function alreadyPosted(sql: Sql, key: string): Promise<boolean> {
  const r = (await sql`select status, attempts from telegram_posts where key = ${key}`) as { status: string; attempts: number }[];
  return r.length > 0 && !(r[0].status === "failed" && r[0].attempts < 3);
}

/** Claim → send → record. A key that was sent is never sent again. */
async function post(sql: Sql, key: string, kind: string, report: RunReport, send: () => Promise<number>) {
  const claimed = (await sql`
    insert into telegram_posts (key, kind) values (${key}, ${kind})
    on conflict (key) do update set attempts = telegram_posts.attempts + 1, status = 'claimed'
      where telegram_posts.status = 'failed' and telegram_posts.attempts < 3
    returning key
  `) as unknown[];
  if (!claimed.length) return;
  try {
    const id = await send();
    await sql`update telegram_posts set status = 'sent', message_id = ${id}, posted_at = now() where key = ${key}`;
    report.posted.push(key);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 300) : String(err);
    await sql`update telegram_posts set status = 'failed', detail = ${msg} where key = ${key}`;
    report.errors.push(`${key}: ${msg}`);
  }
}
