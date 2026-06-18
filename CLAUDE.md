# 42soccer: Complete Build Instructions for Claude Code

> **RENAME (2026-06-18):** The product was renamed to **All In Football** (domain **allinfootball.com**). Everywhere this spec says "42soccer", read "All In Football"; where it says "42soccer.com", read "allinfootball.com". The brand mark monogram is "AIF". The repository folder is still named `42soccer/` (internal only — not renamed to avoid breaking paths). Everything below is the original spec, preserved for reference.

**Product:** All In Football (originally 42soccer)  ·  **Domain (connect later):** allinfootball.com  ·  **Genre:** football (soccer) tracking web app

How to use this document: it lives as `CLAUDE.md` in the repository root so every Claude Code session loads it as persistent context. The KICKOFF section (15) is the first message that started the build. The FOOTBALL_API_KEY is supplied as an environment variable, never pasted into chat or code.

---

## 0. PROJECT SUMMARY
Build a production-grade football tracking web app called 42soccer, with the information architecture of a modern football portal (news, a deep match center, reference data, a personalized home), scoped to exactly nine competitions, and styled to match the approved dashboard mockup. Information depth like FotMob, presentation like the approved design. The visual reference mockup is labeled "PitchLine" in its top-left corner: that is the design source only. The product name everywhere in the UI, metadata, and copy is **42soccer**. Never render "PitchLine" anywhere.

---

## 1. OPERATING PROTOCOL (how to work)
1. Work in the five milestones in section 14. After each milestone, STOP, report the Definition of Done checklist status, and wait for my approval before starting the next.
2. At the start of each milestone, first list the exact files you will create or change, then build.
3. Run the relevant tests and the type-check before declaring a milestone done. A milestone is not done if the build fails, types fail, or tests fail.
4. Ask me before: changing the tech stack, adding a competition outside the nine, adding authentication, adding any paid third-party service, or anything that would incur cost.
5. Do not scrape any website. All data comes from the API-Football REST API and from public RSS feeds (link-out only).
6. Keep FOOTBALL_API_KEY server-side only. Never expose it to the browser, never hardcode it, never commit it. Read it from process.env.
7. If a provider call fails, never crash a page. Degrade gracefully (section 10).
8. Prefer clarity over cleverness. Comment the adapter and the cache. Write the README as you go.

---

## 2. SCOPE: NINE COMPETITIONS ONLY
Hardcode these in `src/lib/constants/competitions.ts`. League IDs are API-Football ids and are stable across seasons.

| Competition | Body | league id | season |
|---|---|---|---|
| Premier League | England | 39 (verified) | 2025 (means 2025/2026) |
| La Liga | Spain | 140 (verified) | 2025 |
| Serie A | Italy | 135 (verified) | 2025 |
| Bundesliga | Germany | 78 (verified) | 2025 |
| Ligue 1 | France | 61 (verified) | 2025 |
| UEFA Champions League | UEFA | 2 (verified) | 2025 |
| UEFA Europa League | UEFA | 3 (verified) | 2025 |
| MLS | USA | 253 (verify at build) | 2026 (calendar-year league) |
| FIFA World Cup | FIFA | 1 (verify at build) | 2026 |

Season convention: a season is its starting year, so 2025/2026 is 2025. MLS and the World Cup are calendar-year, so they use 2026. Premier League is the default home competition.

**BUILD STEP ZERO** (run before building UI): call `GET /leagues?search=MLS` and `GET /leagues?search=World Cup` once, confirm the ids for MLS and World Cup, write the confirmed values into the constants file, and assert the other seven ids at startup. Add `getCurrentSeason(competitionId)`: read the season where `current === true` from `/leagues`, cache for 24h, and fall back to the constants above. Do not hardcode the year forever.

---

## 3. TECH STACK (pin these)
- Next.js 15 (App Router), TypeScript in strict mode, Node 20 LTS.
- Tailwind CSS v3, driven entirely by the design tokens in section 12. No hardcoded hex in components.
- Font: Inter (or Geist as a near-identical fallback). Tabular figures for all scores, points, and stats.
- Data fetching: server-side only, via Next.js route handlers under `src/app/api/*` that proxy API-Football, hide the key, normalize into our domain types, and cache.
- Caching: behind an interface (`src/lib/cache/index.ts`), in-memory LRU for v1, swappable for Redis later.
- Testing: Vitest.
- Dates: store and transport everything in UTC ISO 8601, render in the user's timezone (default Europe/London), do all date math in UTC.
- Deployment: Vercel, custom domain 42soccer.com (connected later).

---

## 4. REPOSITORY STRUCTURE
```
42soccer/
  CLAUDE.md                      (this document)
  README.md
  .env.local                     (gitignored: FOOTBALL_API_KEY=...)
  .gitignore                     (must include .env*.local)
  next.config.ts
  tailwind.config.ts
  tsconfig.json
  vitest.config.ts
  package.json
  public/placeholders/           (gradient + silhouette placeholder assets)
  src/
    app/
      layout.tsx                 (AppShell, metadataBase=https://42soccer.com)
      page.tsx                   (home dashboard)
      matches/page.tsx
      matches/[date]/page.tsx
      match/[slug]/page.tsx
      competition/[slug]/page.tsx
      competition/[slug]/(fixtures|table|scorers|news)/page.tsx
      team/[slug]/page.tsx
      player/[slug]/page.tsx
      (coach|referee|stadium)/[slug]/page.tsx
      news/page.tsx
      news/[slug]/page.tsx
      (about|terms|rules)/page.tsx
      api/(live|fixtures|standings|scorers|match|news|search)/route.ts
      sitemap.ts
      robots.ts
    components/
      shell/      (AppShell, Sidebar, GreetingHeader, SearchAutocomplete)
      cards/      (HeroFeatureCard, MatchCard, UpcomingMatchCard, NewsCardDark, FollowingCard, PlayerSpotlightCard)
      rail/       (LiveNowRail, TopTableRail, TopNewsRail)
      tables/     (StandingsTable, TopScorersTable)
      match/      (FormationPitch, CommentaryFeed, EventTimeline, StatComparisonBar)
      primitives/ (Skeleton, EmptyState, ErrorBanner, Crest, Tag, Pill, Logo)
    lib/
      providers/  (types.ts, apiFootball.ts, footballDataOrg.ts, statusMap.ts)
      cache/index.ts
      news/        (rss.ts, tagging.ts)
      profile/index.ts            (localStorage: name, following, teams, favorites)
      constants/competitions.ts
      design/tokens.ts
      utils/       (date.ts, slug.ts)
    styles/globals.css            (CSS variables from section 12)
    test/          (sample provider JSON, adapter.test.ts, smoke.ts)
```

---

## 5. DATA PROVIDER ABSTRACTION
- `src/lib/providers/types.ts` defines OUR domain types (section 6). Pages and components consume ONLY these, never raw API-Football JSON.
- `src/lib/providers/apiFootball.ts` is the single adapter. Base URL `https://v3.football.api-sports.io`, header `x-apisports-key: process.env.FOOTBALL_API_KEY`.
- `src/lib/providers/statusMap.ts` maps API-Football status codes to our enum:
  `NS -> scheduled` · `1H,2H,ET,P,LIVE -> live` · `HT -> ht` · `FT,AET,PEN -> finished` · `PST -> postponed` · `CANC -> cancelled` · `ABD -> abandoned` · `SUSP,INT -> suspended` · `TBD -> scheduled`. Every consumer must handle all of these.
- Pagination: `/players` returns 25 rows per page. Always read `paging.total` and loop; never assume one page is complete.
- The fixture id is the master key: lineups, events, statistics, odds, and predictions all take a fixture id.
- Stub `src/lib/providers/footballDataOrg.ts` (interface only) so a Premier-League-only free fallback is possible via a PROVIDER env var.

Endpoints used: `/leagues`, `/fixtures` (by date, by league+season, or `live=all`), `/fixtures/events`, `/fixtures/lineups`, `/fixtures/statistics`, `/fixtures/headtohead`, `/standings`, `/players/topscorers`, `/players/topassists`, `/teams`, `/players`, `/odds`.

Cache TTLs: live 15s, lineups 60s, standings and fixtures 120s, top scorers 300s, teams and competitions 24h, news 300s.

---

## 6. DOMAIN MODEL
```ts
Competition { id; slug; name; country; type:'league'|'cup'|'international'; logo; currentSeasonId }
Season { id; competitionId; label; year; isCurrent }
Team { id; slug; name; shortName; country; crest; venueId? }
Player { id; slug; name; position; nationality; teamId?; number? }
Match { id; slug; competitionId; seasonYear; round; kickoffUtc; status; minute?;
        homeTeamId; awayTeamId; homeScore?; awayScore?; venueId?; refereeId?; attendance?; broadcaster? }
MatchEvent { id; matchId; minute; extraMinute?;
        type:'goal'|'own_goal'|'penalty'|'missed_penalty'|'assist'|'sub'|'yellow'|'red'|'var';
        teamId; playerId?; relatedPlayerId?; detail? }
Lineup { matchId; teamId; formation?; starters:LineupPlayer[]; bench:LineupPlayer[]; coachName? }
LineupPlayer { playerId; name; number?; position?; gridRow?; gridCol? }
MatchStats { matchId; teamId; shots?; sot?; possession?; passes?; passAccuracy?; saves?;
        corners?; fouls?; offsides?; yellow?; red?; shotsInBox?; shotsOutBox?; blocked?; xg?; xgot? }
Standing { competitionId; seasonYear; groupLabel:string|null; position; teamId;
        played; won; drawn; lost; gf; ga; gd; points; form:('W'|'D'|'L')[] }
TopScorer { competitionId; seasonYear; playerId; teamId; goals; assists; rank }
Article { id; slug; title; dek; image?; publishedAtUtc; sourceName; sourceUrl;
        body?; competitionTags:string[]; teamTags:string[]; playerTags:string[] }
```
All numeric stat fields are optional because providers omit them for some competitions (xG may be absent). Components must degrade gracefully when a field is null (render "-", hide the xG block if both teams lack xG).

---

## 7. PERSONALIZATION WITHOUT AUTH (v1)
The home is a personalized dashboard (Your Teams, Following, "Good evening, {name}"), but v1 has NO login system. Back the display name, Following, Your Teams, and Favorites with localStorage behind `src/lib/profile/index.ts`, so it can later be swapped for real accounts. The greeting is time-of-day aware with an editable name (lightweight settings panel). Following, Your Teams, and Favorites are limited to entities within the nine competitions.

---

## 8. PAGES
**Home `/`** (the dashboard, exactly matching the design): three-column shell. Left sidebar (section 11). Main feed: greeting header with search; hero feature card (top story or top finished match of the day); Upcoming Matches row (3 cards across the nine competitions); then a trio of cards: Top News (dark), Following (lime), Player Spotlight (dark). Right rail: Live Now, Top Table (Premier League default), Top News.

**Match calendar** `/matches`, `/matches/[date]` (and today/yesterday/tomorrow): horizontal date strip plus month picker; matches grouped by competition (Premier League first); filter tabs All / Live / Finished / Favorites; auto-refresh while any match is live.

**Match center** `/match/[slug]`: header (both teams, crests, score, status with live minute, scorers with minute, competition-round breadcrumb). Tabs: Summary (event timeline), Live (minute-by-minute commentary), Lineups (FormationPitch plus list view, bench, coach), Stats (shots, sot, possession %, pass accuracy %, passes, saves, corners, fouls, offsides, cards, shots in/out box, blocked, xG, xGOT as comparison bars), Head-to-head, Table, Odds (neutral data only). Below: match info (referee plus flag, stadium, attendance, broadcaster), team news, recent and upcoming fixtures for both teams.

**Competition hub** `/competition/[slug]` plus `/fixtures`, `/table`, `/scorers`, `/news`. Standings columns: Pos, Club (crest plus name), Pld, W, D, L, GF, GA, GD, Pts, Form (last 5 as W/D/L pills). Linear mode for the eight leagues; group mode for the World Cup (Groups A to L plus a third-place ranking view).

**Team** `/team/[slug]` (Overview, Fixtures, Results, Squad, News, Table). **Player** `/player/[slug]`. Reference: `/coach/[slug]`, `/referee/[slug]`, `/stadium/[slug]`. **News** `/news` and `/news/[slug]`. Static: `/about`, `/terms`, `/rules`.

Sidebar nav maps to scope: Home, Matches, Following, Leagues (= the nine competitions), Teams, Players, News, Videos (optional, "coming soon" unless a highlights provider is added), Transfers (= transfer-tagged news filter for v1).

---

## 9. COMPONENT LIBRARY (all styled to section 12)
AppShell (3-column responsive), Sidebar, GreetingHeader, SearchAutocomplete (min 2 chars, across teams/players/competitions), HeroFeatureCard, MatchCard (variants below), UpcomingMatchCard, NewsCardDark, FollowingCard (lime), PlayerSpotlightCard, LiveNowRail (red LIVE pill, aria-live), TopTableRail, TopNewsRail, StandingsTable (linear + group), TopScorersTable (Goals / Assists / Goals+Assists tabs), FormationPitch (SVG; falls back to a list if formation is missing), CommentaryFeed, EventTimeline, StatComparisonBar (null-safe), and primitives Skeleton, EmptyState, ErrorBanner, Crest, Tag, Pill, Logo.

MatchCard variants: scheduled (date + time), live (pulsing minute in live-minute green), ht ("HT" in live-red), finished (final score, muted), postponed / cancelled / abandoned / suspended (status word, never a minute). Scores use tabular figures.

Logo component renders the 42soccer wordmark with a black rounded-square mark carrying a lime "42" glyph. Never the mockup's name.

---

## 10. ERROR, EMPTY, AND EDGE STATES (mandatory)
- Loading: a skeleton on every data section, never a blank flash.
- Empty states, each distinct: no matches on a date ("No matches in your competitions on this day"), lineups not posted ("Lineups confirmed about 1 hour before kickoff"), stats before kickoff ("Stats available once the match begins"), no standings for a knockout stage, empty news river.
- Provider 429 and 5xx: exponential backoff with jitter inside the adapter, serve last-good cached data if available, surface a small non-blocking "Data may be delayed" banner. Never crash a page.
- Missing fields: render "-" for null scores and stats, never "undefined" or "NaN". xG block self-hides if both teams lack xG.
- Match statuses: render postponed, cancelled, abandoned, suspended distinctly, with no live minute.
- World Cup transition: group stage (12 groups plus third-place ranking) then knockout, where standings do not apply (show a bracket placeholder or hide the Table tab). Drive everything off groupLabel and stage, never a hardcoded match count.
- Live lifecycle: show the LIVE pulse and minute only for 'live', "HT" for 'ht', and stop client polling when no on-screen match is live or ht.

---

## 11. NEWS (v1) AND IMAGERY
News: `src/lib/news/rss.ts` fetches and parses BBC Sport Football, Guardian Football, Sky Sports, and 90min; `tagging.ts` dedupes by title plus url and keyword-tags each item to the nine competitions and their clubs. Display headline, dek, image, source name, time, and an outbound "Read full story at {sourceName}" link to sourceUrl. Do NOT store or render full article bodies; `Article.body` stays empty in v1. The river shows only items relevant to the nine competitions.

Imagery (keep legally clean): club and competition crests come from the data API's logo URLs. News and player images come from the feed. Where the feed has no image, render a placeholder (gradient block or silhouette from public/placeholders), never a hardcoded copyrighted photo. The mockup's specific action shots are design placeholders, not assets to reproduce.

---

## 12. DESIGN SYSTEM (the approved look; implement exactly)
**Brand:** modern football dashboard. Light base, near-black feature cards for emphasis, one bold lime-green accent used sparingly. Generous rounding, soft hairline borders, confident bold headings.

**Color tokens (CSS variables in globals.css, mirrored in design/tokens.ts):**
```
--accent-lime       #CDF24A    accent: active nav, tags, highlights, Following card
--accent-lime-soft  #EAF8B8    active nav pill background, soft fills
--surface-dark      #101114    hero, Top News dark card, Player Spotlight
--surface-dark-2    #1A1C20    raised elements on dark, score chip
--page-bg           #F6F7F9    app background
--card-bg           #FFFFFF    default cards
--border-hairline   #ECEEF1    borders, dividers, table rules
--text-primary      #15171A
--text-secondary    #6B7280
--text-on-dark      #FFFFFF
--text-on-dark-dim  #A8ADB5
--live-red          #EF4444    LIVE dot, HT
--live-minute       #16A34A    live minute text
--star-gold         #F5B301    favorited team star
```
Provide a dark-theme variant by swapping surface and text tokens (accent and live colors stay). A theme switch must be a token swap, not a rewrite.

**Typography (Inter):**
```
Greeting / H1   30px / 700 / -0.02em
Section title   20px / 600
Card title      16px / 600
Body            14px / 400
Meta / small    13px / 500 / text-secondary
Numeric         tabular-nums
```
**Layout:** sidebar 240px (fixed), main fluid (max ~880px, 28px gutters), right rail 340px (fixed), column gap 24px. Radii: cards 18px, inner tiles and buttons 12px, pills and tags full. Card padding 22px. Shadows very soft; rely on hairline borders.
Responsive: at <=1200px move the right rail below the main column; at <=820px collapse the sidebar to a top bar with a hamburger (or bottom tab bar on mobile) and stack single-column. Mobile-first.

**Signature components (match the mockup):**
- Sidebar: white, hairline right border, 42soccer logo top, nav rows (18px icon + 14px/500 label), active row = lime-soft pill with a lime left indicator, hover #F2F3F5. "YOUR TEAMS" section with followed clubs (gold star on primary) and "+ Add team". Bottom promo card.
- GreetingHeader: time-of-day "Good evening, {name}" plus subtitle; center-right full-pill search input; far right notification bell and avatar with chevron.
- HeroFeatureCard: dark rounded card, tag pill (e.g. "UCL SEMI FINAL"), bold 2-line headline, 2 to 3 line dek, white "Match Report" button with arrow; right side feature image with a diagonal mask and a floating score chip (surface-dark-2: crests, large score, status); a lime accent shape bleeding off the right edge.
- UpcomingMatchCard: competition label with logo at top, home crest + name (left), date and bold time (center), away crest + name (right). White, hairline border.
- NewsCardDark: dark card, rounded thumbnail left, white headline, dim meta time.
- FollowingCard: lime background, dark text, rows of logo/avatar + name + sublabel + bell toggle.
- PlayerSpotlightCard: dark card, right-masked portrait, name, "Club • #number • Position", a 3-column stat strip (Matches, Goals, Assists), white "View Profile" button.
- LiveNowRail: title + red LIVE pill, rows of crest + name + score, status right-aligned (minute in live-minute, HT in live-red), "View all live matches" link, auto-refresh while live.
- TopTableRail: competition badge (Premier League default), compact Pos / Team / Pld / GD / Pts, top 5, "View full table".
- TopNewsRail: a lead image card with overlaid headline and meta, then one or two text headlines.

**Accessibility:** AA contrast (lime is for fills and large or bold text, not small body text on white), full keyboard nav, visible focus rings, alt text on crests and images, aria-live on Live Now scores, prefers-reduced-motion disables the live pulse.

---

## 13. SEO, DOMAIN, AND DEPLOYMENT
- `metadataBase = new URL('https://42soccer.com')` in the root layout. og:site_name = "42soccer".
- Per-page metadata: title, description, canonical (https://42soccer.com/...), Open Graph, Twitter card.
- JSON-LD: SportsEvent on match pages, SportsTeam on team pages, BreadcrumbList on entity pages.
- Generate `sitemap.ts` (home, the nine competition hubs, recent and upcoming matches, teams, players) and `robots.ts` (allow all, point to the sitemap).
- SSR plus ISR on all entity pages so they are indexable.
- Deployment: Vercel. Set FOOTBALL_API_KEY as a Vercel Environment Variable (Production and Preview). The custom domain 42soccer.com is connected later; build so the canonical and metadataBase already point to it. Document the domain connection steps in the README.

---

## 14. MILESTONES (stop and report DoD after each)
**M1 Foundation and dashboard shell.** Pinned stack; design tokens implementing section 12 exactly; globals.css variables; AppShell + Sidebar (42soccer logo) + GreetingHeader + SearchAutocomplete; provider interface; apiFootball adapter with status map and pagination; competitions constants; build-step-zero id verification; cache interface; .env.local and .gitignore; and the Home dashboard wired to real data for at least the Upcoming Matches row and the Live Now rail. Other home cards may use loading or placeholder states until their routes exist.
DoD: app builds, type-checks, and runs; sidebar, greeting, search, hero shell, Upcoming row, and Live Now render and visually match the design; FOOTBALL_API_KEY is server-side only; adapter unit tests pass for fixtures and the status map; every color and type size comes from a token; the UI shows "42soccer", never "PitchLine".

**M2 Match center and calendar.** `/matches` with date strip, filters, and live auto-refresh; `/match/[slug]` with all tabs (Summary, Live, Lineups with FormationPitch, Stats, Head-to-head, Table, Odds-as-data); every empty, error, and edge state from section 10.
DoD: a recent or live fixture shows timeline, lineups, and stats; the pending-lineup and no-xG states render correctly; a postponed match shows no live minute; adapter tests cover events, lineups, and statistics.

**M3 Competitions, entities, and home completion.** `/competition/[slug]` plus fixtures/table/scorers/news with StandingsTable in BOTH linear and World Cup group modes; `/team/[slug]`; `/player/[slug]`; reference pages; and the remaining home cards (Top News, Following, Player Spotlight, Top Table, Top News rail) wired to real data.
DoD: Premier League table renders linear; World Cup renders 12 groups plus third-place; a knockout stage hides or replaces the table; scorers tabs work; the full home dashboard is populated and matches the design; standings adapter tests (linear and group) pass.

**M4 News and SEO.** RSS aggregation filtered to the nine competitions with link-out and tagging; reference pages finished; per-page SEO and JSON-LD per section 13; sitemap and robots.
DoD: the news river shows only relevant items with outbound links and no full bodies; entity pages emit valid structured data; canonical URLs use 42soccer.com; Lighthouse SEO >= 95 on a match page.

**M5 Hardening and deploy.** 429 backoff with jitter and last-good-cache fallback; SSE (or polling) live updates within the request budget; accessibility pass (section 12); dark-theme token set; Vercel config; README (setup, env vars, provider swap, rate budget, 42soccer.com domain connection); `npm run smoke` green.
DoD: a simulated 429 degrades gracefully with the delayed-data banner; the Live Now region announces score changes; the smoke test passes; the README is complete; the dark-theme switch works via tokens.

---

## 15. KICKOFF
> You are a senior full-stack engineer building 42soccer, per the CLAUDE.md in this repo. Confirm three things back to me in one short paragraph: (a) the nine-competition scope, (b) that the design system in section 12 is the visual source of truth and the UI brand is "42soccer" (never "PitchLine"), and (c) the milestone gates with a stop for my review after each. Then begin Milestone 1: run BUILD STEP ZERO (verify the MLS and World Cup league ids via /leagues and write them into the constants file), list the exact files you will create, and build M1. Pause at the M1 Definition of Done and report the checklist status. The FOOTBALL_API_KEY is in the environment; never print it.

---

## 16. TESTING AND VERIFICATION (throughout)
- Vitest unit tests for `apiFootball.ts` against recorded sample JSON for each endpoint (fixtures, events, lineups, statistics, standings linear, standings group, topscorers), asserting correct mapping to domain types, the status map, null-field handling, and the pagination loop. This adapter is the highest-risk code; it must be tested.
- `npm run smoke` hits your own `/api` routes for one Premier League fixture and one World Cup group and prints pass or fail.
- `npm run type-check`, `npm run lint`, `npm run test`, and `npm run build` must all pass before any milestone is marked done.

---

## 17. SECURITY AND COMPLIANCE
- Key handling: FOOTBALL_API_KEY in `.env.local` (gitignored) locally and as a Vercel env var in production. Server-side only. Regenerate the key from the API-Football dashboard before production launch.
- Legal: no scraping; no betting calls-to-action, affiliate links, or gambling promotions in v1 (odds render as neutral data only); no full-text article republication (headline, dek, link-out only); no hosted or embedded broadcast video (licensed highlights or official embeds only).
