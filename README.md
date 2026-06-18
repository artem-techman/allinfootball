# All In Football

A production-grade football (soccer) tracking web app — news, a deep match center,
reference data and a personalized home — scoped to exactly **nine competitions** and
styled to the approved dashboard design. Information depth like FotMob, presentation
like the approved mockup. The UI brand is **All In Football** everywhere (the mockup's
"PitchLine" label is a design reference only and is never rendered).

> Full product spec and build protocol live in [`CLAUDE.md`](./CLAUDE.md). This README
> covers setup, env vars, the provider swap, the rate budget and the domain connection.

## Tech stack

- **Next.js 15** (App Router) · **TypeScript** (strict) · **Node 20 LTS**
- **Tailwind CSS v3**, driven entirely by design tokens (`src/styles/globals.css` +
  `src/lib/design/tokens.ts`) — no hardcoded hex in components
- **Inter** font, tabular figures for all scores/stats
- Server-side data fetching via route handlers under `src/app/api/*` (the API key is
  never exposed to the browser)
- In-memory LRU cache behind a swappable interface (`src/lib/cache`)
- **Vitest** for unit tests (the adapter is the highest-risk code and is covered)

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then add your FOOTBALL_API_KEY
npm run dev                        # http://localhost:3000
```

Without a key the app runs in **preview mode**: pages render, data sections show
empty/skeleton states, the API routes return `{ delayed: true, reason: "no_key" }`,
and nothing crashes.

## Environment variables

| Variable           | Required | Description                                              |
| ------------------ | -------- | -------------------------------------------------------- |
| `FOOTBALL_API_KEY` | yes      | API-Football REST key. **Server-side only.** Never commit. |
| `PROVIDER`         | no       | `apiFootball` (default) or `footballDataOrg` (stub).     |

`FOOTBALL_API_KEY` is read from `process.env` inside `src/lib/providers/apiFootball.ts`
(marked `server-only`). It is sent as the `x-apisports-key` header and is never logged,
returned in a response, or shipped to the client bundle. `.env*.local` is gitignored.

## Scripts

| Script               | Purpose                                                      |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Dev server                                                  |
| `npm run build`      | Production build                                             |
| `npm run type-check` | `tsc --noEmit` (strict)                                      |
| `npm run lint`       | ESLint (next/core-web-vitals + next/typescript)             |
| `npm run test`       | Vitest unit tests (adapter mappers, status map, pagination) |
| `npm run smoke`      | Hits the local `/api` routes and prints pass/fail (needs the dev server running) |

## Scope — nine competitions only

Premier League (39), La Liga (140), Serie A (135), Bundesliga (78), Ligue 1 (61),
UEFA Champions League (2), UEFA Europa League (3), MLS (253), FIFA World Cup (1).
Hardcoded in `src/lib/constants/competitions.ts`. A season is its **starting year**
(2025/26 → 2025); MLS and the World Cup are calendar-year (2026).

**BUILD STEP ZERO** — once the key is present, run the id verification for MLS and the
World Cup (`verifyLeagueIds()` in `apiFootball.ts`) and confirm the two `verified:false`
entries in the constants file. The seven other ids are asserted at startup via
`assertVerifiedLeagueIds()`.

## Provider swap

All data flows through the `FootballProvider` interface (`src/lib/providers/types.ts`).
`getProvider()` selects the active source from the `PROVIDER` env var. `apiFootball` is
the primary; `footballDataOrg` is a Premier-League-only fallback stub for v1. Pages and
components consume only our domain types — never raw provider JSON.

## Rate budget (cache TTLs)

| Data            | TTL  |
| --------------- | ---- |
| live fixtures   | 15s  |
| lineups         | 60s  |
| standings       | 120s |
| fixtures        | 120s |
| top scorers     | 300s |
| teams / leagues | 24h  |
| news            | 300s |

The cache layer (`src/lib/cache`) also serves last-good stale data on a provider
429/5xx and coalesces concurrent fetches (stale-while-revalidate, single-flight).

## Deployment (Vercel) & the allinfootball.com domain

1. Import the repo into Vercel.
2. Add `FOOTBALL_API_KEY` as an Environment Variable for **Production** and **Preview**
   (and `PROVIDER` if not `apiFootball`).
3. Deploy. `metadataBase` and canonical URLs already point at `https://allinfootball.com`.
4. Connect the custom domain: Vercel → Project → **Settings → Domains** → add
   `allinfootball.com` (and `www`), then update DNS at the registrar with the records Vercel
   shows (apex `A`/`ALIAS` to Vercel, `www` `CNAME` to `cname.vercel-dns.com`). No code
   change is needed — the canonical host is already configured.
5. Before launch, **regenerate the API-Football key** from its dashboard.

## Theme

Dark is the default. A toggle in the sidebar footer flips `data-theme` on `<html>`
between dark and light — a pure **token swap** (only surface/text variables change;
accent + live colors stay). The choice is persisted in `localStorage` and applied
pre-paint by a tiny inline script in `layout.tsx`, so there's no flash.

## Accessibility

AA-contrast text tokens, visible `:focus-visible` rings (lime), alt text on crests,
`aria-live` on the Live Now scores (announces changes), and `prefers-reduced-motion`
disables the live pulse.

## Resilience

The adapter retries 429/5xx with exponential backoff + jitter; the cache serves
**last-good stale data** on failure (stale-while-revalidate, single-flight). When data
is degraded, a non-blocking "Data may be delayed" banner appears — the page never
crashes. Run `npm run smoke` (with the dev server up) to exercise the live, PL fixture,
PL match, World Cup group, and news routes end-to-end.

## Milestones

Built in five gated milestones (see `CLAUDE.md` §14), all complete: **M1** foundation +
dashboard, **M2** match center + calendar, **M3** competitions/entities/home completion,
**M4** news + SEO, **M5** hardening + deploy. The visual system is dark by default with a
light token variant.
