# Contributing to My Football Tracker

This repo is the website at https://myfootballtracker.com (Next.js 15, App Router, TypeScript, Tailwind).
It is **public**: never put anything private in a commit, branch name, PR or comment.

## Who merges
- `main` is protected. Every change from a contributor arrives as a **pull request** and is merged only after the owner's review. Merging to `main` deploys to production.
- Contributors (including **Pep**, our AI operator, GitHub user `ryonagent`) open branches and PRs only. Never push to `main`.

## Pep's scope
Pep's PRs may touch **content, SEO pages and growth/monetization features**:
- `src/app/**` pages and their metadata (titles, descriptions, new content pages)
- `src/components/**` presentation and UI
- `src/lib/seo/**` copy and page-building helpers (no network calls added)
- `public/**` static assets you created or have the rights to
- tests in `src/test/**` for anything you change

Pep's PRs must **not** touch (a PR that does will be closed):
- secrets of any kind, `.env*` files, keys, tokens, passwords
- `src/lib/providers/**` (the football-data adapter and quota protection)
- `src/lib/db/**`, `db/**` (database), `src/lib/auth/**`, `src/lib/email/**`, `src/lib/telegram/**`
- `src/app/api/**` (server endpoints and cron jobs)
- `vercel.json`, `next.config.ts`, `middleware.ts`, `.github/**`, `package.json` / `package-lock.json`
  (if a feature truly needs a new dependency or server change, describe it in the PR and the owner will do it)

## Run it locally
Needs Node 20.
```bash
npm ci
npm run dev
```
Open http://localhost:3000. No secrets are needed: without `FOOTBALL_API_KEY` the site runs in demo mode with sample data, which is enough for UI and content work. Never ask for or use the production keys.

Before opening a PR, run:
```bash
npm run type-check
npm run lint
npm test
```
CI runs the same three checks on every PR; a red PR won't be reviewed.

## Repo structure
| Path | What it is |
|---|---|
| `src/app/` | Routes: home, `match/[slug]`, `competition/[slug]/...` (table, fixtures, scorers, news, `round/[round]`), `team/[slug]/[tab]`, `player/[slug]`, `matches/[date]`, `news`, static pages, `sitemap.ts`, `robots.ts` |
| `src/components/` | UI: `cards/`, `match/`, `team/`, `competition/`, `rail/`, `shell/`, `tables/`, `seo/` (JSON-LD), `primitives/` |
| `src/lib/seo/` | Titles, descriptions, written previews/reports, round pages, team pages, share cards |
| `src/lib/news/` | RSS news aggregation and tagging (link-out only, never full articles) |
| `src/lib/providers/` | Football data adapter (off-limits) |
| `src/test/` | Vitest unit tests |

House rules: data comes only from our provider and public RSS (no scraping); no betting calls-to-action or affiliate links; no full-text article copies; no match footage; never invent stats.

## Pull request format
- Branch: `pep/<short-topic>` (e.g. `pep/round-page-copy`).
- Title: what changes for the visitor, in plain words (e.g. "Add 'top scorers this round' to round pages").
- Body:
  1. **Why:** which growth metric it should move (search traffic, shares, returning visitors, signups) and the evidence.
  2. **What:** the files changed and what each does.
  3. **How to check:** the pages to open and what you should see; screenshots for UI changes.
  4. **Risks:** anything that could break, and confirmation it stays inside Pep's scope.
- Small PRs (one idea each) get reviewed fastest.
