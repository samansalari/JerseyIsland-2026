<div align="center">

<img src="public/Logo__2_.png" alt="VotePulse Logo" width="120" />

# VotePulse

**Public, non-partisan election intelligence for Jersey's 2026 General Election**

[![Live Site](https://img.shields.io/badge/Live%20Site-votepulse.je-1a2b4a?style=for-the-badge&logo=vercel&logoColor=gold)](https://votepulse.je)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Railway](https://img.shields.io/badge/Hosted%20on-Railway-7b2fff?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-gold?style=for-the-badge)](LICENSE)

<img src="public/hero-banner.png" alt="VotePulse — The Power of One Vote" width="100%" style="border-radius:12px; margin: 24px 0;" />

</div>

---

VotePulse is an open, independent platform that helps Jersey voters make informed decisions. It aggregates candidate profiles, AI-summarised manifestos, issue comparisons, and a live **Public Pulse** dashboard — all without partisan bias.

> Sources are preserved and linked wherever possible. AI-generated content is clearly labelled with disclaimers.

---

## What's inside

| Feature | Description |
|---------|-------------|
| **Candidate Profiles** | District, party, **role badge** (Senator / Deputy / Connétable), AI summary & issue stances, and a **typography-styled "Original Manifesto" card**. Manifesto text is rendered by **`<ManifestoContent />`** (`src/components/manifesto-content.tsx`) which parses cleaned markdown into structured `heading` / `subheading` / `paragraph` blocks (bold-only short lines like `**Candidate for Deputy St. Helier Central**` render as `<h4>` subheadings) and provides an **expand/collapse** for long manifestos with a word-count label. Cleaning is centralised in **`src/lib/clean-manifesto.ts`** — `cleanManifestoForStorage` runs at ingest (scraper + importer + one-off DB cleaner) and strips vote.je SVG icon labels, navigation, footer boilerplate, flow.je breadcrumbs, YouTube embed boilerplate (`Tap to unmute`, `… - YouTube` title, `[…](youtube.com/…)` links, `![thumbnail-image](…)`, `Vote Jersey N subscribers`); `cleanManifestoForDisplay` additionally strips markdown links/URLs/images and the historical prefix (rendered separately). Historical flow.je data shown with an amber notice when no 2026 manifesto exists. Social links extracted from `social_links` JSONB via `buildSocialLinks()`. **Data sources** are now rendered **inside the manifesto card** as a collapsible `<details>` block — labelled clickable links via `getSourceLabel(url)` (e.g. `2016 Vote.je manifesto`, `Flow.je profile`, `YouTube video`, `SOS Jersey Q&A`), opening in a new tab with `rel="noopener noreferrer"`. |
| **Side-by-Side Compare** (`/compare`) | Deep comparison table for 2–4 candidates: photo, AI summary, party, district, and 10 canonical issue rows (housing → public services) with position, confidence badge, **structured action points list** (✓/✗ icons, max 3 visible + "+N more" overflow), and expandable source quote. |
| **Action Points Pipeline** | Per-issue **structured action points** (`ActionPoint[]`) plus a four-state **`stanceType`** (`supportive` / `opposing` / `concerned` / `neutral`) extracted by Grok and stored inside each `IssueStance` in `candidates.ai_issues` (jsonb). Replaces the previous "single dense paragraph per issue" model with a scannable bulleted list of concrete proposals (`Build 500 affordable homes by 2028`, not `Supports housing`). Display surfaces: **Issue Sheet** drawer (homepage tile → drawer with per-candidate cards, ✓/✗ icons by action type, expandable per-action source-quote `<details>`, stance badge), **Compare grid** (max 3 action points + "+N more" overflow per issue cell), **Candidate profile** (`Issue Positions` cards with stance badge, action points list, source quotes). All three surfaces fall back to the legacy `position` paragraph when a row predates the pipeline (`actionPoints` / `stanceType` are typed **optional**). Types live in **`src/db/schema.ts`** (`ActionPoint` + `IssueStance`); validator + Grok prompt in **`scripts/enrich.ts`**. |
| **Official-list sync** (`scripts/sync-official-candidates.ts`) | Reconciles the `candidates` table against a hardcoded `OFFICIAL_2026_CANDIDATES` list (single source of truth, `scripts/data/official-2026-candidates.ts`). Archives historical rows (`is_2026 = false`), updates name / role / district / party / `manifesto_url` for existing rows, and inserts new candidates. Robust matching via slug → name → `NAME_ALIASES`. `--dry-run` flag for safe preview. |
| **Public Pulse** (`/trends`) | Live issue poll (one vote / 24h per fingerprint), community star ratings, real-time leaderboard, and AI-generated insight text refreshed every 6 hours via a Railway worker cron. |
| **Policy Intelligence** (home) | Ten topic tiles: live **candidate counts and sample stances** from `candidates.ai_issues` (jsonb) even when `topic_summaries.ai_summary` is NULL. `topic_upvotes` for interest. Tiles show three states: AI summary, or “*N* candidates have positions” + italic teaser, or no positions yet. Drawer loads `GET /api/topics/[issue]`. Fingerprinted upvotes/feedback. Topic Grok rows: `generate:topics` / cron; optional `topic_summaries.candidate_count` sync via SQL. |
| **Data Pipeline** | flow.je JSON → `import:local` → `scrape:vote` → `scrape:manifestos` → `extract:social`. Optional follow-up: **`discover:social`** (extra URLs in manifesto text) → **`scrape:social`** (Firecrawl + Grok, Facebook/website/LinkedIn only). AI enrichment via xAI Grok. |
| **AI Supervision** | **Independent second-pass review** of every Grok-generated `ai_summary` by **Kimi K2.6** (Moonshot AI) via OpenRouter. Scores 1–10 for accuracy, neutrality, hallucination, and completeness; raises typed flags; auto-corrects summaries scoring ≤ 5. Results land in `candidates.review_status` (jsonb) and `candidates.last_reviewed_at`. Source: `src/lib/supervisor.ts` + `scripts/review-summaries.ts`. Cron pass daily at **02:00 Europe/London**. |
| **Admin Panel** (`/admin`) | **Supabase Auth** (no `ADMIN_SECRET`). **Dashboard** (`(protected)/page.tsx`): live Drizzle stats — candidates, `ai_summary`, non-empty `ai_issues`, manifesto coverage, topic counts, upvotes, feedback, enrichment %, last enriched, **Kimi K2.6 Quality Review** (reviewed count / average score / pass / fail) — `export const dynamic = 'force-dynamic'`. **Candidates** (`/admin/candidates`): full searchable table (all rows), **Review** column (score + Pass/Fail + flag count, colour-coded), re-enrich per candidate (server action → `scripts/enrich.ts`). **Scrapers** (`/admin/scrapers`): trigger `POST /api/admin/run-scraper` (`flow_je`, `vote_je`, `policy_je`, `ingest_news`, `enrich_articles`). **AI Enrichment** (`/admin/enrichment`): batch `POST /api/admin/enrich-batch`, topic refresh `POST /api/admin/generate-topics` (`scripts/generate-topics.ts`), pulse insight `POST /api/admin/regenerate-insight`. **Public Pulse** (`/admin/pulse`): vote/rating stats, insight preview, `clear-pulse` + regenerate. |
| **Rate Limiting** | ioredis-backed rate limits on Pulse vote/rate routes; fails open when `REDIS_URL` is unset. |
| **Nav & footer** | **Navbar** (`src/components/navbar.tsx` `NAV_LINKS`) and **footer** Navigate list (`src/app/layout.tsx` `FOOTER_NAV_LINKS`) use the same six entries: `Home` → `/`, `Candidates` → `/candidates`, `Districts` → `/districts`, `Compare` → `/compare`, **Public Pulse** (display label) → `/trends`, `About` → `/about`. |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15** — App Router, TypeScript, ISR |
| Styling | **Tailwind CSS 3** — Jersey palette (`jersey-red`, `gold`, `navy`) |
| Fonts | **Archivo** via `next/font/google` |
| Database | **PostgreSQL** via Drizzle ORM (`postgres` driver, `prepare: false` for Supabase pooler) |
| AI (writer) | **xAI Grok** — manifesto summaries, issue stances, article sentiment |
| AI (reviewer) | **Kimi K2.6** (`moonshotai/kimi-k2.6`) via **OpenRouter** — independent fact-checker for Grok summaries (256K context, plain `fetch`, no SDK) |
| Scraping | **Firecrawl** (`@mendable/firecrawl-js`) |
| Hosting | **Railway** — Web (Next.js) + Worker (`scripts/cron.ts`) |
| Rate limits | **ioredis** + `REDIS_URL` |
| Analytics | **Google Analytics 4** (`G-4WZWNNE0LP`) + **Microsoft Clarity** (`whg4c7n340`) via `next/script` in `src/app/layout.tsx` (`afterInteractive`). |
| Cron | Railway worker — 6h Pulse insight · 2h news · daily **02:00 `Europe/London`** Kimi K2.6 supervisor · daily 03:00 UTC maintenance · **daily 06:00 `Europe/London` social** (discover → scrape) · 27 Apr 08:00 official-list chain |

---

## Architecture

```
Browser ──► Next.js on Railway (Web)
              │
              ├──► PostgreSQL (Supabase pooler, port 6543)
              │
              └──► Railway Worker (cron.ts)
                      ├── Firecrawl / RSS scrapers
                      ├── xAI Grok enrichment            (writes ai_summary)
                      ├── Kimi K2.6 supervisor (02:00)   (reviews ai_summary
                      │   via OpenRouter                  → review_status jsonb)
                      └── POST /api/revalidate (ISR)
```

---

## Getting started

### Prerequisites

- Node.js **20+**
- PostgreSQL (local Docker, Railway, or Supabase)
- **Supabase** project URL + **anon** key (`NEXT_PUBLIC_SUPABASE_*`) for admin sign-in; admin users created in Supabase Auth (no `ADMIN_SECRET`)
- `REDIS_URL` for production rate limiting (optional locally)
- xAI Grok API key (`GROK_API_KEY`) + Firecrawl API key for scrapers
- **OpenRouter API key (`OPENROUTER_API_KEY`)** for the Kimi K2.6 supervisor — get one at <https://openrouter.ai/settings/keys>

### Local setup

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env.local
# Set DATABASE_URL, NEXT_PUBLIC_SITE_URL, and optional keys

# 3. Database
npm run db:migrate     # applies drizzle/*.sql — social_links, Pulse tables, etc.

# 4. Seed
npm run db:seed        # issue taxonomy
npm run seed           # candidates

# 5. Dev server
npm run dev
# → http://localhost:3000   health: /api/health
```

### Useful scripts

| Script | What it does |
|--------|-------------|
| `dev` / `build` / `start` | Standard Next.js |
| `typecheck` / `lint` | `tsc --noEmit` / `next lint` |
| `db:generate` / `db:push` / `db:migrate` / `db:studio` | Drizzle ORM |
| `db:seed` | Issues taxonomy |
| `import:local` | flow.je JSON → candidates |
| `scrape:vote` | vote.je batch profiles |
| `scrape:manifestos` | **Two phases**: (1) discover 2026 vote.je manifesto URLs and merge longer text into `manifesto_raw`; (2) **historical fallback** — for candidates with empty / boilerplate manifestos, re-scrape their flow.je profile to find historical `vote.je/candidates/<year>/…` URLs, scrape the most recent one, prepend `[Historical manifesto from vote.je — <year> election. No 2026 manifesto published yet.]\n\n`, and merge the URL into `source_urls` (never overwrites real 2026 content). **Both phases run scraped text through `cleanManifestoForStorage` before length/hash compare and DB write**, so vote.je nav noise and YouTube embed boilerplate never reach the DB. Supports `--candidate-slug=<slug>` and `--dry-run`. |
| `clean:manifestos` / `clean:manifestos:dry` | One-off DB cleaner (`scripts/clean-manifesto-data.ts`) that re-applies `cleanManifestoForStorage` to every existing `manifesto_raw`. **Idempotent** — safe to run after broadening any pattern in `src/lib/clean-manifesto.ts`. Dry-run prints a per-candidate `before → after  (-N chars)` diff with no DB writes. Supports `--slug=<slug>` to target a single candidate. |
| `extract:social` | `manifesto_raw` → `social_links` |
| `validate:social` | Report resolvable social URLs |
| `enrich` / `enrich:batch` | xAI Grok enrichment. `enrich:batch` only picks **un-enriched** candidates (`aiSummary IS NULL`); the default `enrich` mode adds a `STALE_DAYS = 7` window. Use **`npx tsx scripts/enrich.ts --force`** to re-enrich **every** candidate with a manifesto regardless of staleness or prior enrichment — this is the schema-migration escape hatch (e.g. after extending `IssueStance` with new fields like `actionPoints` / `stanceType`). The `--force` run also clears `reviewStatus` + `lastReviewedAt` per candidate so the daily Kimi K2.6 cron picks them up. Also accepts `--candidate-slug=<slug>` / `--slug=<slug>` (one candidate). Each run records `--force`-mode tokens under `enrich` in `data/token-usage.jsonl`. |
| `sync:official` / `sync:official:dry` | Reconcile DB to official 2026 vote.je list (see "Official 2026 candidate list" below) |
| `seed:topics` | Seed `topic_summaries` (10 policy issues) |
| `generate:topics` | Regenerate topic summary rows (Grok) — see `scripts/generate-topics.ts` |
| `discover:social` / `discover:social:dry` | Find social URLs in `manifesto_raw` for rows missing `social_links` |
| `scrape:social` / `scrape:social:dry` / `scrape:social:force` | Firecrawl + Grok merge of policy snippets into `ai_summary` / `ai_issues` (skips X/Twitter) |
| `review:summaries` | **Kimi K2.6 supervisor** — review only summaries enriched since last review (default daily mode) |
| `review:summaries:dry` | List which candidates would be reviewed without calling OpenRouter |
| `review:summaries:all` | Re-review every candidate that has an `ai_summary` (one-off bulk pass) |
| `review:summaries:failed` | Re-run only candidates whose previous `review_status.passed = false` |
| `ingest:news` | RSS / news ingest |
| `cron` | Railway worker — full job orchestrator (includes daily social + supervisor cycles) |

> All four `review:*` scripts also accept `--slug=<slug>` to target a single candidate (e.g. `npx tsx scripts/review-summaries.ts --slug=alvin-aaron`).

---

## Deployment (Railway)

VotePulse runs as **two Railway services** from this repo — no Vercel or Cloudflare required.

### Service 1 — Web (Next.js)

1. **New Project → Deploy from GitHub** → select this repo.
2. Railway auto-detects Next.js; or point to `railway.json`.
3. **Health check:** `GET /api/health` (30 s timeout).
4. Set all environment variables before the first build (especially `DATABASE_URL` for pre-rendered candidate pages).

### Service 2 — Worker (cron)

1. Same Railway project → **New → GitHub repo** (this repo again).
2. **Build:** `npm install` only. **Start:** `npx tsx scripts/cron.ts`.
3. Mirror server-side secrets: `DATABASE_URL`, `GROK_API_KEY`, `FIRECRAWL_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `REVALIDATION_SECRET`.

### Environment variables

| Variable | Web | Worker | Notes |
|----------|:---:|:------:|-------|
| `DATABASE_URL` | ✅ | ✅ | Supabase pooler (port 6543, `pgbouncer=true`) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | — | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | — | |
| `GROK_API_KEY` / `XAI_API_KEY` | optional | ✅ | xAI Grok (writer model) |
| `GROK_MODEL` | optional | optional | Default: `grok-4-1-fast-reasoning` |
| `OPENROUTER_API_KEY` | — | ✅ | **Kimi K2.6 supervisor** (`scripts/review-summaries.ts` + daily cron). Without it the supervisor pass exits with a clear error; the rest of the app keeps working. |
| `FIRECRAWL_API_KEY` | — | ✅ | Scrapers |
| `NEXT_PUBLIC_SITE_URL` | ✅ | ✅ | Public URL (ISR revalidation) |
| `REVALIDATION_SECRET` | ✅ | ✅ | `POST /api/revalidate` |
| `REDIS_URL` | recommended | recommended | ioredis rate limiting |
| `NODE_ENV` | `production` | `production` | |

### First-deploy checklist

- [ ] Supabase project created; `npm run db:migrate` applied; **RLS** on public tables (`issue_votes`, `candidate_ratings`, `pulse_insights`, `topic_summaries`, `topic_upvotes`, `topic_feedback`) per [`docs/CODEBASE-REPORT.md`](docs/CODEBASE-REPORT.md) **§4** (SQL not in `drizzle/`)
- [ ] `npm run db:seed` for issues taxonomy
- [ ] `npm run import:local` (flow.je JSON) + `npm run extract:social`
- [ ] `GET /api/health` returns `{ database: "connected" }`
- [ ] Worker logs show `CRON: VotePulse orchestrator starting`
- [ ] `OPENROUTER_API_KEY` set on the worker; `npm run review:summaries -- --slug=<any-enriched-candidate>` returns `✓ PASS` and writes `review_status` to the row
- [ ] `/admin/login` works with a **Supabase Auth** user (email + password); dashboard shows the **"Kimi K2.6 Quality Review"** card

---

## Official 2026 candidate list

The `candidates` table is **reconciled to a hardcoded source-of-truth list** rather than scraped freeform — this prevents drift, name collisions, and accidental inserts when vote.je adds dummy or test rows.

### Files

- **`scripts/data/official-2026-candidates.ts`** — the canonical list (one entry per declared candidate, typed `OfficialCandidate`). Also exports `NAME_ALIASES` for known variants (`Sir Mark Boleat` → `Mark Boleat`, `Stephen Ahier` → `Steve Ahier`, etc.).
- **`scripts/sync-official-candidates.ts`** — the reconciler. Reads the list, fetches all DB rows, then:
  - **Matches** by slug → exact name → `NAME_ALIASES` (in that order).
  - **Archives** rows missing from the official list (`is_2026 = false`) — data is preserved, never deleted.
  - **Updates** matched rows (`name`, `role`, `district`, `party`, `manifestoUrl`, `is_2026 = true`).
  - **Inserts** new official rows that don't match any DB row, generating a slug via `nameToSlug()` (NFKD normalisation, diacritic stripping).
- **`drizzle/0005_add_is2026_and_role.sql`** — adds `is_2026 boolean NOT NULL DEFAULT false` and `role text` to `candidates`, plus `candidates_is_2026_idx`.

### Running the sync

```bash
npm run sync:official:dry   # preview archives / updates / inserts; writes nothing
npm run sync:official       # apply changes

# After sync, refresh manifesto/AI data for newly inserted candidates:
npm run scrape:manifestos
npm run enrich:batch
```

### Public-vs-admin filtering

Every public-facing query filters `WHERE is_2026 = true` — see `src/app/candidates/page.tsx`, `src/app/candidates/[slug]/page.tsx`, `src/app/compare/page.tsx`, `src/app/api/compare/route.ts`, `src/app/districts/[district]/page.tsx`, `src/app/api/districts/[district]/route.ts`, `src/app/trends/page.tsx`, `src/app/api/topics/[issue]/route.ts`, `src/app/sitemap.ts`, `src/app/api/og/route.tsx`, `src/app/candidates/[slug]/opengraph-image.tsx`, and `src/lib/pulse-insight.ts`. **Admin pages do _not_** filter — historical rows remain inspectable under `/admin/candidates`. Do **not** add a year-selector UI to public pages: the contract is "the public site only ever shows 2026 candidates."

### District normalisation

The official list uses `St. Helier` (with a period); the existing DB uses `St Helier` (no period). The sync script's `normaliseDistrict()` strips periods on insert/update so both spellings produce identical rows. Senators' `null` district is mapped to the literal string `"Island-wide (Senator)"` because the column is `NOT NULL`. Super-districts (`St Mary, St Ouen and St Peter`, `Grouville and St Martin`, `St John, St Lawrence and Trinity`, plus `St Helier Central / North / South`) are added to `REAL_JERSEY_DISTRICTS` in `src/app/candidates/page.tsx` so the AEO district capsule renders all constituencies.

### Updating the list (annually or when vote.je changes)

1. Edit `scripts/data/official-2026-candidates.ts` to match the latest `https://www.vote.je/candidates/`.
2. Add `NAME_ALIASES` entries for any new spelling variants (compare to slugs already in the DB).
3. Run `npm run sync:official:dry` and review the planned archives / updates / inserts.
4. Run `npm run sync:official`, then `npm run scrape:manifestos` + `npm run enrich:batch`.
5. Verify counts in Supabase: `SELECT role, COUNT(*) FROM candidates WHERE is_2026 = true GROUP BY role;`.

---

## AI supervision — Kimi K2.6 reviews Grok

VotePulse uses **two independent LLMs** so no single model can ship an unverified summary to voters.

1. **Writer — xAI Grok.** `scripts/enrich.ts` (manual) or the worker cron generate `candidates.ai_summary` and `candidates.ai_issues` from the raw manifesto.
2. **Reviewer — Moonshot Kimi K2.6 via OpenRouter.** `scripts/review-summaries.ts` reads the manifesto + Grok summary and asks Kimi to score it 1–10 and raise typed flags (`hallucination` · `bias` · `attribution_error` · `incompleteness` · `inaccuracy` · `neutrality_breach`).
3. **Persistence.** Result is written to `candidates.review_status` (jsonb) + `candidates.last_reviewed_at`. The `ReviewStatus` and `ReviewFlag` types live in `src/db/schema.ts`.
4. **Auto-correction.** When `score ≤ 5` and Kimi returns a `correctedSummary`, the script overwrites `ai_summary` with Kimi's neutral rewrite and logs a clear `⚠ SCORE n/10 — Grok summary replaced` line.
5. **Visibility.** The admin dashboard's *Kimi K2.6 Quality Review* card shows reviewed count, average score, pass/fail counts, and links to the candidates table where every row has a per-candidate Review column (score / Pass-Fail badge / flag count).
6. **Schedule.** Daily at **02:00 Europe/London** the worker runs `supervisorCycle()` (`scripts/cron.ts`), which calls `scripts/review-summaries.ts` in default mode (only candidates whose `last_enriched_at` is newer than `last_reviewed_at`, plus any never reviewed). After the pass it triggers ISR revalidation.

**Implementation notes (for future development):**

- **No SDK** — `src/lib/supervisor.ts` posts plain JSON to OpenRouter's OpenAI-compatible `/chat/completions` endpoint.
- **Provider routing** — the request body sets `provider: { sort: "throughput", allow_fallbacks: true }` so OpenRouter picks the fastest current Kimi K2.6 host (Io Net / Parasail / Moonshot direct / SiliconFlow / Inceptron / Cloudflare). The chosen provider is logged on every call.
- **Reasoning budget** — Kimi K2.6 is a reasoning model: `max_tokens` covers both internal chain-of-thought *and* the final JSON. We start at **4 000** tokens and automatically retry once at **8 000** if the first call returns `finish_reason: "length"` with empty content.
- **Network resilience** — every call has a 240 s `AbortController` timeout and up to 3 attempts with 5 s back-off for transient empty-200 / non-JSON responses (a rare OpenRouter behaviour we caught in testing). Failed candidates are simply skipped this run and picked up by the next cron pass.
- **Cost** — measured at ~**$0.01–$0.02 per candidate** (mostly reasoning tokens at $4.655/M). A full one-off pass over ~96 active candidates costs **≈ $1.30**; ongoing daily delta cost is **$0.05–$0.20**.
- **Manual ops:** `npm run review:summaries` (incremental), `:all` (full re-review), `:failed` (re-test prior failures), `:dry` (no API calls), or `--slug=<slug>` to target one candidate.
- **Migration** — schema columns added via `drizzle/0006_add_review_status.sql` (run with `npm run db:migrate`).

---

## Action points pipeline (`IssueStance` with `actionPoints` + `stanceType`)

VotePulse extracts **specific, concrete proposals** from each candidate's manifesto rather than dense paragraph summaries — so per-issue pages render `✓ Build 500 affordable homes by 2028` instead of `Supports housing`.

### Schema (`src/db/schema.ts`)

`candidates.ai_issues` is `jsonb $type<IssueStance[]>()`. Each `IssueStance` carries the legacy fields (`position`, `confidence`, `source_quote`) **plus** the optional `stanceType` and `actionPoints` added by the action-points pipeline:

```ts
export type ActionPoint = {
  text: string;                         // ≤ 150 chars (server-enforced)
  type:
    | "action"        // generic thing they will do
    | "commitment"    // firm pledge ("I will…")
    | "opposition"    // explicitly opposes ("I oppose…")
    | "concern";      // raised concern, no specific solution
  sourceQuote: string;                  // verbatim manifesto quote ≤ 300 chars
};

export type IssueStance = {
  issue: string;                        // 10 canonical slugs (housing … public_services)
  position: string;                     // one-sentence overview (legacy/back-compat)
  confidence: number;                   // 0.0 – 1.0
  source_quote: string;                 // primary supporting quote (legacy)
  stanceType?:                          // OPTIONAL — older rows omit it
    | "supportive"   // actively proposes specific action
    | "opposing"     // explicitly opposes a current policy
    | "concerned"    // raises issue but offers no solution
    | "neutral";     // mentions without taking a position
  actionPoints?: ActionPoint[];         // OPTIONAL — empty `[]` when none extracted
};
```

`stanceType` and `actionPoints` are **typed optional** so rows enriched before the pipeline keep working. UI code uses `?.` and `?? []` everywhere; do not make them required.

### Grok extraction (`scripts/enrich.ts`)

- **`ISSUE_EXTRACTION_SYSTEM`** is the system prompt (lines ~181 onward in `enrich.ts`). Six critical rules: (1) action points must be CONCRETE and SPECIFIC — explicit good/bad examples baked into the prompt; (2) classify `stanceType` per issue; (3) every action point needs a verbatim quote; (4) only extract what the manifesto explicitly says (no inference); (5) historical-manifesto handling — extract positions but don't fabricate 2026-specific commitments; (6) ignore election-results tables.
- **`buildIssueExtractionUserPrompt`** wraps the candidate name + first 8000 chars of `manifesto_raw` and asks Grok to return a **top-level JSON object** (`{ "summary": …, "issues": [...] }`) rather than a bare array — required because `grokChatCompletionJson` slices from `{` to `}`.
- **`callGrokForManifesto`** uses `temperature: 0` (deterministic) and `maxTokens: 6000` (action points + reasoning need the headroom — 4000 truncated ~12 % of complex candidates in testing).
- **`validateIssueStance`** normalises every Grok-returned entry: trims strings, clamps `confidence` to `[0,1]`, validates `stanceType` against `VALID_STANCE_TYPES`, validates each `ActionPoint.type` against `VALID_ACTION_TYPES`, drops action points whose `text` is `≤ 5` or `> 200` chars, and **caps each issue at 6 action points** (keeps cards scannable, jsonb column small).
- **Source-quote spot check** — `fuzzyMatch(stance.source_quote, manifestoRaw)` logs a warning when match score < 0.7 (Grok occasionally trims whitespace or normalises punctuation; we don't drop the entry).
- **Re-enrichment side effects** — every successful `enrichOneCandidate` write also clears `reviewStatus = null` and `lastReviewedAt = null` so the next Kimi K2.6 cron pass picks the row up automatically.

### `--force` flag (schema-migration escape hatch)

The default `main()` in `enrich.ts` filters by `aiSummary IS NULL OR lastEnrichedAt < staleDate (7 days)`, and `--batch` filters even harder (`aiSummary IS NULL` only). Neither will pick up candidates re-enriched today. After a schema change like adding `actionPoints` you need to re-enrich **everyone**:

```bash
# Re-enrich every candidate with a manifesto, regardless of prior state
npx tsx scripts/enrich.ts --force
```

The `--force` selector matches `isNotNull(candidates.manifestoRaw)` only. On a 145-candidate cohort this took ~52 minutes and ~$0.11 in Grok tokens (Apr 2026). Combine with `--slug=<slug>` to force a single candidate.

### Display layer

| Surface | File | Behaviour |
|---------|------|-----------|
| **Issue Sheet** drawer | `src/components/issue-sheet.tsx` | Per-candidate `<CandidatePositionCard />` shows avatar, name, district/party, **confidence pill** + **stance badge** (`Has proposals` / `Opposed` / `Concerned` / `Mentions` — coloured by `STANCE_COLOUR`). When `actionPoints.length > 0`, renders a `<ul>` with `✓` (green `#1A6B3A`) for `action`/`commitment`/`concern` and `✗` (red `#A31621`) for `opposition`, plus a per-point `<details>` "Source quote" toggle. Falls back to the `position` paragraph + primary `sourceQuote` blockquote when no action points exist. |
| **Compare grid** | `src/app/compare/comparison-table.tsx` | `IssueCell` renders the `position` paragraph followed by a bulleted `<ul>` of action points (max 3 visible). When more than 3 exist, appends `+{actionPoints.length - 3} more`. ✓/✗ icons match the stance scheme. |
| **Candidate profile** | `src/app/candidates/[slug]/page.tsx` | `IssuePositionCard` (server component) per issue: name, confidence badge, `<StanceBadge />` for `supportive`/`opposing`/`concerned`, position summary, then divider + action points list with grey-italic source quotes. `getCandidatePositions(candidateId, aiIssuesJsonb)` joins the `candidate_issues` table (issue display name) with the jsonb `IssueStance[]` (stance + action points), giving graceful fallbacks (`stanceType ?? "neutral"`, `actionPoints ?? []`). |
| **API** | `src/app/api/topics/[issue]/route.ts` | The `GET` projection now emits `stanceType` and `actionPoints` from the per-candidate `IssueStance`. Candidate ordering: candidates with **more action points first**, then by **confidence desc** (so the deepest positions surface at the top of the drawer). |

### Local DTOs in client components

`issue-sheet.tsx` and `comparison-table.tsx` declare their own `ActionPointDTO` / `StanceTypeDTO` instead of importing `IssueStance` from `@/db/schema`. This is intentional — importing the schema would pull `drizzle-orm` + `postgres` into the client bundle. Keep these local types **structurally identical** to the schema types; if you add a field to `ActionPoint`, mirror it in both DTOs.

### Workflow when adding a new field to `IssueStance`

1. Edit `src/db/schema.ts` — keep the new field **optional** (`?`) so old rows remain valid.
2. Mirror it in the local DTOs in `src/components/issue-sheet.tsx` and `src/app/compare/comparison-table.tsx`.
3. Update the Grok JSON shape in `ISSUE_EXTRACTION_SYSTEM` (and `buildIssueExtractionUserPrompt` if needed) in `scripts/enrich.ts`.
4. Update `validateIssueStance` to accept and normalise the new field (with a sensible default).
5. Update the API projection in `src/app/api/topics/[issue]/route.ts`.
6. Update the three display surfaces (Issue Sheet card, Compare cell, Candidate profile card).
7. Re-run TypeScript + build (`npx tsc --noEmit && npm run build`).
8. Backfill: `npx tsx scripts/enrich.ts --force` (or `--slug=<slug>` if testing).
9. Regenerate topic summaries: `npm run generate:topics` — themes now extract from action points, not just position summaries.
10. Re-run Kimi supervision: `npm run review:summaries:all` (or rely on the daily cron pulling the cleared `lastReviewedAt`).

### Cost & coverage (production, Apr 2026)

- **Full cohort re-enrichment** (`--force` over 145 candidates): **~52 min**, **$0.11**, 384k tokens, 0 failures.
- **Active 2026 (92 candidates):** 80 produced action points; 12 had manifestos too thin to extract any (correctly marked `concerned` with empty `actionPoints` — Cameron Monro is the canonical example).
- **Per-issue depth (active 2026):** public_services 117 action points / 67 candidates · housing 88 / 58 · healthcare 73 / 54 · environment 61 / 48 · economy 50 / 55 · education 46 / 48 · transport 44 / 34 · tax 38 / 34 · cost_of_living 33 / 41 · immigration 26 / 31.
- **Housing stance distribution (active 2026):** 39 supportive · 14 concerned · 5 opposing.

---

## Public Pulse — how it works

- **Voting:** `POST /api/pulse/vote` — Zod-validated issue key, one vote per fingerprint per 24h via `vp_voted` cookie + server fingerprint. Redis-backed rate limit.
- **Ratings:** `POST /api/pulse/rate` — one rating per candidate per 24h.
- **Results:** `GET /api/pulse/results` — aggregates + leaderboard (candidates with ≥ 3 ratings).
- **AI Insight:** `GET /api/pulse/insight` — **DB read only**. Rows written by `generatePulseInsight()` every 6 hours (cron) or via `POST /api/admin/regenerate-insight`. Never calls Grok on request.
- **DB tables:** `issue_votes`, `candidate_ratings`, `pulse_insights` (see `src/db/schema.ts`).
- **RLS (Supabase):** Row Level Security is enabled on those tables plus `topic_summaries`, `topic_upvotes`, `topic_feedback` — `anon` may **SELECT** public-facing rows where applicable; `topic_feedback` has **no** anonymous policy. The Next.js app uses **`DATABASE_URL`** (Drizzle) and **bypasses RLS**; policies protect direct PostgREST / Data API use of the `anon` key.

---

## For auditors & reviewers

- **Policy Intelligence (homepage):** `src/components/issue-intelligence.tsx` loads Drizzle `topic_summaries` + upvote counts, then runs a **Postgres** `jsonb_array_elements` query (CTE) for live per-issue candidate counts and a sample position (highest confidence). The live query is in its own `try/catch` with `console.error` and falls back to `topic_summaries.candidate_count` so all **10** tiles still render if SQL fails. An earlier correlated subquery caused PostgreSQL **42803**; the current CTE avoids ungrouped-column errors.
- **Compare data source:** `/compare` reads `candidates.ai_issues` (JSONB) — typed as `IssueStance[]`. Each entry carries the legacy `position` / `confidence` / `source_quote` fields **plus** the optional `stanceType` and `actionPoints` from the action-points pipeline (see *Action points pipeline* section above). The `candidate_issues` junction table may be empty in some deployments — do not rely on it for the compare grid; the candidate-profile page **does** join it for issue display names but reads stance / action points from the jsonb. UI must treat `stanceType` and `actionPoints` as **optional** and fall back to the legacy paragraph for any record that pre-dates the pipeline.
- **Analytics:** GA4 + Clarity in root layout; reconcile marketing copy (e.g. About “cookies / analytics” claims) with actual tags.
- **Social links:** `buildSocialLinks()` only emits URLs that pass `new URL()`. Re-run `validate:social` after bulk imports.
- **AI layer:** enrichment is **xAI Grok** only (`src/lib/grok.ts`); supervision is **Moonshot Kimi K2.6** via **OpenRouter** only (`src/lib/supervisor.ts`). Anthropic / OpenAI SDKs are **not** installed.
- **Rate limiting:** Redis-backed via ioredis. Routes fail open when `REDIS_URL` is unset.
- **Official list cron:** one-time job at `08:00 Europe/London on 27 April` — runs full scrape → import → enrich → revalidate chain. Adjust annually.
- **`is_2026` + `role` fields:** Added in `drizzle/0005_add_is2026_and_role.sql`. Public queries **must** filter `WHERE is_2026 = true`; admin queries **must not** (so archived rows stay visible). `role` is `Senator | Deputy | Connétable` and drives the role badge on candidate pages and the role filter dropdown on `/candidates`.
- **Historical manifesto fallback:** `scripts/scrapers/scrape-vote-je-manifestos.ts` runs in **two phases**. Phase 1 maps and scrapes 2026 vote.je URLs as before. Phase 2 picks up candidates whose `manifesto_raw` is empty or boilerplate (`isManifestoBoilerplate()` — short text, low policy-keyword density, or matches `flow.je` boilerplate regex), extracts archive URLs from their flow.je markdown via `extractVoteJeArchiveUrls()` (regex `vote.je/candidates/<year>/<slug>`), scrapes the **most recent** historical page, prepends `[Historical manifesto from vote.je — <year> election. No 2026 manifesto published yet.]\n\n`, merges the URL into `source_urls`, writes a `snapshots` row (`source: "pre-historical-vote-je-fallback"`), and clears `ai_summary` / `ai_issues` / `last_enriched_at` so the next enrichment pass picks it up. `alreadyHas2026Content()` (length ≥ 800 chars **and** policy keywords **and** mentions "2026") prevents accidental overwrites of real 2026 content. Supports `--candidate-slug=<slug>` and `--dry-run`. After a refresh, run `npm run extract:social` then `npm run enrich --candidate-slug=<slug>` to surface positions on the candidate page.
- **Clickable data sources:** `getSourceLabel(url)` in `src/app/candidates/[slug]/page.tsx` derives friendly labels from the raw `source_urls` text array (year-aware for `vote.je/candidates/<year>/…`, plus flow.je / YouTube / SOS Jersey / Wikipedia / BBC / ITV / JEP / Bailiwick Express / gov.je) and renders each as `<a target="_blank" rel="noopener noreferrer" class="text-sm text-[#A31621] hover:underline">` inside a collapsible `<details>` block at the foot of the manifesto card.
- **Manifesto cleaning pipeline:** **`src/lib/clean-manifesto.ts`** is the single source of truth for stripping Firecrawl noise from `manifesto_raw`. Two pure functions (no browser APIs / DB / network — safe in server components and scripts):
  - **`cleanManifestoForStorage(raw)`** — runs at ingest time inside `scripts/scrapers/scrape-vote-je-manifestos.ts` (Phase 1 + Phase 2), `scripts/import-local-scrapes.ts`, and the one-off `scripts/clean-manifesto-data.ts`. Strips vote.je SVG icon labels (`Twitter icon`, `Mobile navigation icon`, etc.), the orphaned single-word artefacts that survive icon stripping (`Divider`, `Tick`), the `Morier House … contact@vote.je` footer, the flow.je `flow.je / elections / candidates` breadcrumb, the "has participated in N elections since YYYY" stat line (rendered by the dedicated Election History card instead), and the **YouTube embed boilerplate** that vote.je's autoplay player produces (`… - YouTube` title line, `Tap to unmute`, every `[…](https://youtube.com/…)` markdown link, `![thumbnail-image](…)`, `Vote Jersey N subscribers`). Defangs `[vote.je](url)` markdown links inside the historical prefix so the candidate page's amber notice renders as plain text. Normalises whitespace-only lines so the embed-removal doesn't leave a stray gap. **Preserves** markdown headings (`#`, `##`), bold (`**…**`), and the `[Historical manifesto from vote.je …]` prefix. Idempotent — safe to call multiple times.
  - **`cleanManifestoForDisplay(raw)`** — runs inside `<ManifestoContent />`. Calls `cleanManifestoForStorage` first, then drops the historical prefix (rendered separately as an amber notice), cuts everything from `## Election History` onward (rendered by its own component), strips remaining markdown links / standalone URLs / images / horizontal rules / flow.je `©` and `Return to Top` footer artefacts. Keeps headings + bold so the block parser in `<ManifestoContent />` can render them as styled `<h3>` / `<h4>` / `<p>`. Also exports **`isManifestoMeaningless(raw)`** for gating empty-manifesto UI.
  - **Workflow when adding a new noise pattern:** edit `VOTE_JE_NAV_NOISE_PATTERNS` in `clean-manifesto.ts` → `npm run clean:manifestos:dry` to preview the per-candidate char-removal diff → `npm run clean:manifestos` to apply → if the new noise had already poisoned AI summaries, clear them so the next enrichment pass re-reads the clean text:
    ```sql
    UPDATE candidates
    SET ai_summary = NULL, ai_issues = '[]'::jsonb,
        last_enriched_at = NULL, review_status = NULL,
        last_reviewed_at = NULL, updated_at = NOW()
    WHERE slug IN (...);
    ```
  - **Manifesto display:** **`src/components/manifesto-content.tsx`** is a `'use client'` component that takes the raw manifesto, runs `cleanManifestoForDisplay`, parses the result into typed blocks via `parseManifestoBlocks` (`heading` / `subheading` / `paragraph`; bold-only short lines like `**Candidate for Deputy St. Helier Central**` become subheadings), and renders styled typography (`<h3>` with bottom border, `<h4>` semibold, `<p>` text-`[#0D1B2A]/75`). For manifestos > 600 chars (`PREVIEW_CHARS`) it shows a truncated set of blocks plus a chevron toggle labelled `Read full manifesto (~N words)` (word count = `Math.ceil(cleaned.length / 5)`). Used only by `src/app/candidates/[slug]/page.tsx`.
- Full audit trail: [`docs/CODEBASE-REPORT.md`](docs/CODEBASE-REPORT.md) (§0 changelog · §13 LLM/human review checklist).

---

## Design tokens

Canonical colours in `tailwind.config.ts` and `globals.css`:

| Token | Colour |
|-------|--------|
| `jersey-red` | `#8B1A1A` |
| `navy` | `#1a2b4a` |
| `gold` | `#C9A84C` |
| `surface` | off-white |
| `on-primary` | text on dark backgrounds |

Prefer Tailwind utilities (`bg-jersey-red`, `text-gold`) over inline hex.

---

## Contributing

Issues and pull requests are welcome. Keep changes focused and match existing formatting and patterns. For large changes, open an issue first to discuss approach.

---

## Licence

[MIT](LICENSE) — open-source, non-partisan, built for Jersey.

---

<div align="center">
<sub>Built by <a href="https://seenovate.co.uk">Seenovate ltd</a> · <a href="https://votepulse.je">votepulse.je</a></sub>
</div>
