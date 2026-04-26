# VotePulse — Codebase Report

**Generated:** 23 April 2026  
**Last documentation sync:** 26 April 2026 — **Policy Intelligence (homepage) + analytics + SQL hardening** — **Home** (`src/app/page.tsx`, ISR `revalidate = 21600`) renders **`IssueIntelligence`** (`src/components/issue-intelligence.tsx`): Drizzle loads **`topic_summaries`** + grouped **`topic_upvotes`** counts; a **raw Postgres** query uses **`jsonb_array_elements(candidates.ai_issues)`** in a **CTE** (`rows` + `best_pos` with `DISTINCT ON (issue)`) to compute live **per-issue candidate counts** and a **sample position** (highest-confidence `position` text). **`jsonb_typeof(ai_issues) = 'array'`** guards bad JSON. The live query runs in a **nested `try/catch`** with **`console.error('[IssueIntelligence] …')`**; on failure, tiles still render using **`topic_summaries.candidate_count`** (never an empty grid). An earlier design used a **correlated subquery** under `GROUP BY` and triggered PostgreSQL **42803** (*subquery uses ungrouped column "issue_item.value" from outer query*) — **fixed** by the CTE pattern. **`IssueSheet` (`issue-sheet.tsx`)** — three **tile** states (AI summary / live counts + italic teaser / empty), **"See positions →"** CTA, amber banner in drawer when summary missing but positions exist. **API:** `GET/POST /api/topics/[issue]/*` (summary + candidates, upvote, feedback). **Tables:** `topic_summaries`, `topic_upvotes`, `topic_feedback` in `src/db/schema.ts`. **Scripts:** `npm run seed:topics`, `npm run generate:topics` (`scripts/seed-topics.ts`, `scripts/generate-topics.ts`). **Admin dashboard:** `src/app/admin/(protected)/page.tsx` — `dynamic = 'force-dynamic'`, live stats from `candidates` + topic tables. **Social:** `discover-social-links.ts`, `scrape-social.ts`, cron **`socialScrapeCycle()`** at **06:00 `Europe/London`**. **RLS (Supabase):** enabled on six public tables; `anon` SELECT where applicable; `topic_feedback` has no `anon` policy; app `DATABASE_URL` **bypasses** RLS. **Analytics:** **Google Analytics 4** (`G-4WZWNNE0LP`) + **Microsoft Clarity** (`whg4c7n340`) — both **`next/script`**, `strategy="afterInteractive"`, in **`src/app/layout.tsx`**. Reconcile public copy (e.g. cookies/analytics) with these tags. Previous sync: **Phase 9: Supabase admin auth** — `ADMIN_SECRET` removed; Supabase `signInWithPassword`, middleware, `(protected)/admin`, `admin-guard`. Earlier: AEO capsules, dynamic OG, compare, Public Pulse.

**Additional documentation sync (26 Apr 2026 — admin UI + nav parity):** **`src/app/admin/(protected)/candidates`** — full candidate table (all rows), client search/filter, **Re-enrich** via server action (`candidates/actions.ts`: Supabase `getUser()`, `runRepoScript('scripts/enrich.ts', ['--candidate-slug=…'])`). **`scrapers`** — client calls **`POST /api/admin/run-scraper`** with JSON **`{ scraperName }`** (`flow_je` \| `vote_je` \| `policy_je` \| `ingest_news` \| `enrich_articles`); response **`{ ok, durationSec, outputTail }`**. **`enrichment`** — batch **`POST /api/admin/enrich-batch`**; topic Grok refresh **`POST /api/admin/generate-topics`** (`src/app/api/admin/generate-topics/route.ts` — **`runRepoScript('scripts/generate-topics.ts')`**, `requireAdmin`, `maxDuration` 600); insight **`POST /api/admin/regenerate-insight`**. **`pulse`** — Drizzle counts on **`issue_votes`** / **`candidate_ratings`**, latest **`pulse_insights`** ordered by **`generated_at`** (columns **`insight_type`**, **`content`** — not `created_at`); client clear/regenerate. **Footer:** **`FOOTER_NAV_LINKS`** in **`src/app/layout.tsx`** matches **`NAV_LINKS`** in **`src/components/navbar.tsx`** — same six **`href`/`label`** pairs (**Public Pulse** → **`/trends`**). **`README.md`** “What’s inside” updated accordingly.

## 0. What changed (recent — for auditors & LLMs)

| Topic | Change |
|-------|--------|
| **Policy Intelligence — homepage** | **`src/app/page.tsx`**: `IssueIntelligence` server section; **`revalidate = 21600`**. **`src/components/issue-intelligence.tsx`**: `topicSummaries` + upvotes + optional raw SQL for live counts/sample quote; **nested** SQL `catch` + fallback. **`src/components/issue-sheet.tsx`**: client drawer, fetches `GET /api/topics/[issue]`, upvote/feedback POST. **DB:** `topic_summaries`, `topic_upvotes`, `topic_feedback` (`src/db/schema.ts`). **Enrichment / ops:** `scripts/seed-topics.ts`, `scripts/generate-topics.ts` (`npm run seed:topics`, `generate:topics`). **SQL note:** CTE with `DISTINCT ON (issue) ORDER BY issue, confidence DESC` replaces a **broken** correlated `jsonb_array_elements` subquery that caused **42803**. |
| **Admin dashboard — live stats** | **`src/app/admin/(protected)/page.tsx`**: `export const dynamic = 'force-dynamic'`, `metadata` (title, `robots: noindex`). **Supabase** `getUser()`; redirect to login if absent. **Parallel Drizzle** queries: totals for candidates, `aiSummary`, non-empty **`aiIssues`**, `manifestoRaw`, **`topicSummaries`** (count + with-summary filter), **`topicUpvotes`**, **`topicFeedback`**, enrichment %, **last enriched** row. Replaced legacy six-card view (`issue_votes` / `articles` headline stats). |
| **Admin — candidates table** | **`src/app/admin/(protected)/candidates/page.tsx`** + **`candidates-table.tsx`**: all candidates in one query (`orderBy` `updatedAt` desc); stats strip; client search (name/district) + filter All / Enriched / Not enriched. **`candidates/actions.ts`**: `reEnrichCandidate` — not `requireAdmin(NextRequest)`; uses **`createClient()`** + `getUser()` then **`runRepoScript`** (same contract as **`POST /api/admin/re-enrich`**). |
| **Admin — scrapers** | **`src/app/admin/(protected)/scrapers/page.tsx`**: `max(lastScrapedAt)` / `max(lastEnrichedAt)` from **`candidates`**. **`scrapers-client.tsx`**: five scraper buttons → **`/api/admin/run-scraper`** (existing **`src/app/api/admin/run-scraper/route.ts`**, `runRepoScript` on **`scripts/scrapers/*.ts`** where mapped). |
| **Admin — AI enrichment** | **`src/app/admin/(protected)/enrichment/page.tsx`** + **`enrichment-client.tsx`**: pending = manifesto present & `ai_summary` null; **`enrichment-client`** calls **`enrich-batch`**, **`generate-topics`**, **`regenerate-insight`**. |
| **Admin — Public Pulse** | **`src/app/admin/(protected)/pulse/page.tsx`**: vote/rating totals, votes-by-issue, latest insight preview. **`pulse-admin-client.tsx`**: confirm-clear **clear-pulse**; **regenerate-insight** (then reload). **`pulse_insights`**: use **`generated_at`**, **`insight_type`**. |
| **POST /api/admin/generate-topics** | **`src/app/api/admin/generate-topics/route.ts`**: `requireAdmin` + **`runRepoScript('scripts/generate-topics.ts')`** + `mergeCronState`; **`runtime` = `nodejs`**, `maxDuration` 600. |
| **Footer — Navigate labels** | **`FOOTER_NAV_LINKS`** in **`src/app/layout.tsx`** — identical to **`NAV_LINKS`** in **`navbar.tsx`**: Home `/`, Candidates `/candidates`, Districts `/districts`, Compare `/compare`, **Public Pulse** `/trends`, About `/about`. |
| **Social pipeline (discovery + scrape)** | **`scripts/discover-social-links.ts`**: manifesto regex for extra social URLs when `social_links` empty; **`--dry-run`**, **`--slug=`**. **`scripts/scrape-social.ts`**: Firecrawl **`scrapeUrl`**, Grok JSON merge into **`ai_issues`** / **`ai_summary`**; targets facebook / website / linkedin only. **`scripts/cron.ts`**: **`socialScrapeCycle()`** — cron **`0 6 * * *`**, **`Europe/London`**, runs discover + scrape + **`triggerRevalidation`**. **npm:** `discover:social`, `discover:social:dry`, `scrape:social`, `scrape:social:dry`, `scrape:social:force`. |
| **RLS (Supabase production)** | **`issue_votes`**, **`candidate_ratings`**, **`pulse_insights`**, **`topic_summaries`**, **`topic_upvotes`**, **`topic_feedback`**: RLS **enabled**; **`anon` SELECT** policies on the first five; **`topic_feedback`**: no **`anon`** policy. Next.js app uses **`DATABASE_URL`** and **bypasses** RLS. Policy SQL is **not** in `drizzle/` — replicate in Supabase SQL Editor for new projects. |
| **Microsoft Clarity** | **`src/app/layout.tsx`**: inline Clarity bootstrap (`CLARITY_PROJECT_ID` / `whg4c7n340`) after GA, **`id="microsoft-clarity"`**, `afterInteractive`. |
| **Supabase admin auth (Phase 9)** | **`ADMIN_SECRET` removed** from `src/lib/env.ts` and the codebase. **Login:** `src/app/admin/login/page.tsx` — server component, email + password, **`action={login}`** from **`src/app/admin/login/actions.ts`** (`signInWithPassword`). **Middleware:** `src/lib/supabase/middleware.ts` — `getUser()` then redirect unauthenticated `/admin/*` (except `/admin/login`) to login; redirect authenticated `/admin/login` → `/admin`; unauthenticated `GET/POST` under `/api/admin/*` → **401** JSON. **Protected UI:** `src/app/admin/(protected)/layout.tsx` — `getUser()` + `redirect` + **`AdminNav`**; URLs stay `/admin`, `/admin/candidates`. **API:** `src/lib/admin-guard.ts` — `createServerClient` + `getUser()` for `requireAdmin`. **Legacy:** `src/app/api/admin/login/route.ts` returns **410**; `src/lib/admin-auth.ts` **unused** (HMAC cookie helpers retained in repo but not imported). |
| **AEO Answer Capsule — `/candidates`** | **`src/app/candidates/page.tsx`**: adds four aggregate Drizzle queries (`districtCounts`, `totalEnriched`, `independentCount`, `partyBreakdown`) using `count`, `sql`, `ne`, `isNotNull` from `drizzle-orm`. Renders a **`<section id="aeo-answer-capsule">`** above the candidate grid: gold top-accent bar, `<article>` with `<h2>`, **lead `<p id="aeo-lead">`** (direct-answer, ≤65 words, real DB counts), 4-stat grid (135 candidates / 14 districts / enriched count / 10 issues), **`<ul id="aeo-district-list">`** linking to each district page, 10-issue badge row, source attribution. `metadata.description` rewritten to 50-word direct-answer starting with "Jersey's 2026 general election (7 June 2026) has 135 declared candidates…". **`titleSegment`** updated to "All 135 Candidates — Jersey 2026 General Election". |
| **AEO — `/candidates/[slug]`** | **`src/app/candidates/[slug]/page.tsx`**: `generateMetadata` direct-answer description (name, district, party/Independent, first sentence of `aiSummary`). **`id="aeo-candidate-lead"`** on the amber AI summary section for speakable targeting. The separate full **`<section id="aeo-candidate-answer">`** capsule (duplicate hero facts) was **removed** in UI cleanup; JSON-LD speakable uses **`#aeo-candidate-lead`** only. |
| **AEO Answer Capsule — `/districts/[district]`** | **`src/app/districts/[district]/page.tsx`**: imports `count`, `eq`, `sql` from `drizzle-orm`; adds `districtStats` query (total candidates, `withSummary` filter, `parties` `array_agg`). Renders **`<section id="aeo-district-answer">`** above `<DistrictTable>`: `<h2>` + **`<p id="aeo-district-lead">`** with real DB counts (total candidates, summaries available, party list). `generateMetadata` description rewritten to direct-answer format. |
| **Speakable JSON-LD — candidates listing** | **`src/app/candidates/page.tsx`**: inline `<script type="application/ld+json">` inside page JSX (server-rendered). Schema: `WebPage` with `speakable.cssSelector: ["#aeo-lead","#aeo-district-list"]` + `mainEntity` as `ItemList` (one `ListItem` per district with candidate count and district URL). `numberOfItems` = real `all.length`. |
| **Speakable JSON-LD — candidate pages** | **`src/lib/candidate-jsonld.ts`** `generateCandidateJsonLd()`: `speakable: { "@type": "SpeakableSpecification", cssSelector: ["#aeo-candidate-lead"] }` on the `WebPage` node (redundant AEO **section** `#aeo-candidate-answer` was removed; lead id lives on the amber AI summary block). |
| **Root metadata description** | **`src/app/layout.tsx`**: `metadata.description`, `openGraph.description`, and `twitter.description` rewritten to the 52-word direct-answer format: "VotePulse is Jersey's non-partisan election intelligence platform for the 2026 general election on 7 June 2026. Compare 135 candidates across 14 districts. AI-generated manifesto summaries, policy positions on housing, healthcare, and tax. Free. No ads." |
| **AEO principles applied** | All capsules are **static server-rendered HTML** — no `useState`, no `useEffect`, no client components inside capsules. Lead paragraphs are declarative factual statements in the first 40–60 words. Stat density: one concrete number per cluster (135 candidates, 14 districts, 83 AI summaries, 10 issues). Semantic HTML: `<article>`, `<section>` with `aria-label`, `<ul role="list">`, `<dl>/<dt>/<dd>` for structured facts. |
| **Dynamic OG — `/api/og`** | **`src/app/api/og/route.tsx`**: `GET` with **`?slug=`** (Drizzle `candidates` by `slug` — `name`, `district`, `party`, `aiSummary`) returns **1200×630 PNG** via **`ImageResponse`**; no **`export const runtime = "edge"`** (Railway Node). Fonts: **`@fontsource/archivo`** WOFF (400/700) read with **`fs.readFileSync`** from `node_modules/…/files` — Satori in this stack accepts **WOFF**, not WOFF2. **No `?slug` / `?type=home` →** fallback brand card. Unknown slug **200** + fallback, not 404. **`export const dynamic = "force-dynamic"`**. |
| **Candidate + site metadata OG URLs** | **`src/app/candidates/[slug]/page.tsx` `generateMetadata`:** `openGraph.images` + `twitter.images` use **`${siteBase()}/api/og?slug=${c.slug}`** (absolute URL), **`type: "image/png"`**, 1200×630. **Root `layout.tsx`:** default **`/api/og`** (no query) for **site-wide** OG + Twitter. |
| **OG cache** | **`next.config.ts` `headers`:** `source: "/api/og"` → **`Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`**. |
| **Compare page (deep table)** | **`/compare`** uses **`src/app/compare/comparison-table.tsx`**: candidate header, **summary** row (line-clamp + expand + profile link), **district & role** (+ optional bio snippet), **party** row, **10 fixed issue rows** (`ALL_ISSUES`: housing … public_services) with **ConfidenceBadge** (High/Medium/Low from `confidence`) and **expandable source quotes**; **Sources** row (manifesto URL + `sourceUrls` + internal profile link). **`src/app/compare/compare-client.tsx`** fetches comparison data after **Compare →** and passes full objects to the table. |
| **`GET /api/compare`** | Returns **camelCase** projection: `id`, `name`, `slug`, `district`, `party`, `bio`, `photoUrl`, `aiSummary`, **`aiIssues`** (JSONB), `manifestoUrl`, `sourceUrls`, `manifestoRaw`. Query **`?ids=`** — **2–4 comma-separated UUIDs**; **invalid UUID → 400**. Order of results matches query order. Implementation: `src/app/api/compare/route.ts`. |
| **AI issue data source** | **Primary source for `/compare` and candidate AI display:** `candidates.ai_issues` **JSONB** (array of `{ issue, position, source_quote, confidence }`). The **`candidate_issues`** table may exist but **not be populated** in some runs; **do not rely on it** for the compare UI. Enrichment still may write junction rows from `scripts/enrich.ts` when that path runs. |
| **Grok (no Anthropic)** | Enrichment uses **xAI Grok** only: `src/lib/grok.ts` (OpenAI-compatible **`POST https://api.x.ai/v1/chat/completions`**), `scripts/enrich.ts`, `scripts/enrich-articles.ts` with **`import "./bootstrap-env"`** so `.env.local` loads before `grok` is evaluated. Default model: **`DEFAULT_GROK_MODEL`** in `grok.ts` (keep in sync with enrich scripts). **`@anthropic-ai/sdk` removed.** |
| **flow.je JSON import** | **`scripts/import-local-scrapes.ts`** + **`npm run import:local` / `import:local-scrapes`**: reads **`data/flow.je/*.json`** (Firecrawl-style `markdown` + `metadata`) into **`candidates`**. **`extractBio()`** rejects table rows (`\|`), election stats, flow.je “participated in N elections…” boilerplate. **`extractManifesto()`** cuts before **`## Election History`**, runs **`cleanMarkdown` before stripping markdown links** (so nav bullets stay detectable), strips tables/HRs. On update: sets **`bio`** from import (including **`null`**) and clears **`ai_summary`**, **`ai_issues`**, **`last_enriched_at`** so enrichment re-runs. |
| **vote.je manifesto harvest** | **`scripts/scrapers/scrape-vote-je-manifestos.ts`** — **`mapSite`** + per-URL **`scrapeUrl`** (`src/lib/firecrawl.ts`), fuzzy name match, updates **`manifesto_raw`** when longer/hash differs; clears AI fields; writes **`snapshots`**. **`npm run scrape:manifestos`**. Complements batch **`scrape-vote-je.ts`**. |
| **Cron — official list day** | **`scripts/cron.ts`** schedules **`0 8 27 4 *`** with **`timezone: Europe/London`**: manifesto scraper → flow scrape → **`import-local-scrapes`** → **`extract-social-links`** → **`enrich --batch`** → revalidate. **Yearly** expression — adjust if the real drop date changes. |
| **Manifesto UX** | **`src/app/candidates/[slug]/page.tsx`**: **`has2026Content`** (AI summary **or** issue positions **or** long manifesto mentioning **2026**) controls an **amber banner** above “Original Manifesto” when only historical flow.je text exists. |
| **Main nav (desktop + mobile)** | **`src/components/navbar.tsx`** — client; **`NAV_LINKS`** (six items); **desktop** horizontal nav + **mobile** slide-over drawer in the same file. **`RootLayout`** passes **`adminButton={<AdminNavButton />}`** when applicable. There is no separate `nav-mobile.tsx`. |
| **Rate limiting** | `src/lib/rate-limit.ts` — **ioredis** + `REDIS_URL`, sliding window per IP; `family: 0` for Railway dual-stack. If `REDIS_URL` is unset, limits are skipped (open). Used by pulse APIs and others as wired. |
| **Public Pulse** | **`/trends`** (nav **“Public Pulse”**): server `src/app/trends/page.tsx` loads candidates; client **`src/app/trends/pulse-client.tsx`** — issue poll, star ratings, `GET /api/pulse/results` every **30s**, Zod issue/rating validation (`src/lib/validate.ts`). Votes: **`vp_voted`** cookie + 24h fingerprint; **`GET`/`POST /api/pulse/vote`**; rate limit when **`REDIS_URL`**. Ratings: **`POST /api/pulse/rate`**. Insight: **`GET /api/pulse/insight` reads `pulse_insights` only** (latest `issue_summary` or `issue_analysis`) — **no Grok on request**. Text generation: `generatePulseInsight()` in **`src/lib/pulse-insight.ts`** via **`scripts/generate-pulse-insight.ts`** in **`scripts/cron.ts` 6h cycle** + **`POST /api/admin/regenerate-insight`**. `POST /api/admin/clear-pulse` clears votes/ratings. |
| **Candidate pages** | Hero **`SocialLinks`**; URLs built in **`src/lib/social-links.ts`** (`buildSocialLinks`) from **`candidates.social_links`** JSONB. |
| **Ops scripts** | **`scripts/extract-social-links.ts`** (`npm run extract:social`) populates `social_links` from manifesto text. **`scripts/validate-social-links.ts`** (`npm run validate:social`) — counts candidates with ≥1 resolvable `buildSocialLinks` URL. |
| **Footer** | **Navigate** column: **`FOOTER_NAV_LINKS`** in **`src/app/layout.tsx`** (same `href`/`label` pairs as **`navbar.tsx`**). **`src/components/seenovate-footer-credit.tsx`** (client) — Seenovate link + heart hover. Muted text uses **`text-on-primary/*`** on **navy** footer. |
| **About** | `src/app/about/page.tsx` — AI copy references **xAI Grok** (not Claude). **`src/components/about-actions.tsx`** — client buttons (mailto + Buy Me a Coffee hover). |
| **Worker shutdown** | `scripts/cron.ts` — `SIGINT`/`SIGTERM` call `process.exit(0)`; no top-level `process.exit(0)` (would kill the long-running scheduler). |
| **Dependencies** | **ioredis** for Redis rate limiting; **`@fontsource/archivo`** for `/api/og` font data. No Anthropic SDK. |

---

## 1. Project Overview

VotePulse is a public, non-partisan election intelligence site for Jersey’s 2026 general election. It surfaces candidates, AI-assisted manifesto summaries, issue-level comparisons, **Public Pulse** (issue poll + ratings + DB-backed “Analysis” blurb on `/trends`), and news/sentiment views, with source URLs and AI disclaimers emphasised in the UI.

**Tech stack (actual):** Next.js **15** (App Router, TypeScript, ISR on several routes), Tailwind CSS **3.4** (not v4), Drizzle ORM + `postgres` driver, Zod-validated `DATABASE_URL` / `NEXT_PUBLIC_SITE_URL`, **xAI Grok** (OpenAI-compatible HTTP to `api.x.ai`), Firecrawl, RSS ingestion scripts, Supabase-oriented connection settings (`prepare: false` for pooler). **ioredis** for optional Redis rate limits. **Social cards:** per-candidate and default site **`og:image` / `twitter:image`** via **`/api/og`** (`next/og` on the **Node** server, not edge). **Untitled UI is not installed**; the UI is custom Tailwind aligned to a Jersey palette.

**Current state:** Public pages, **compare** (deep table + `ai_issues` from JSONB), **pulse** routes, `src/lib/rate-limit.ts`, API routes listed in §6, and scripts (scrapers, enrich, import-local-scrapes, **generate-pulse-insight**, cron) are implemented. **Admin** uses **Supabase Auth** (email + password, no self-registration): **server action** sign-in, **HttpOnly** session cookies via **`@supabase/ssr`**, **`src/middleware.ts`** + `src/lib/supabase/middleware.ts` for session refresh and route protection, **`requireAdmin`** in `src/lib/admin-guard.ts` (Supabase `getUser()`). **Protected admin UI** includes the dashboard at **`/admin`**, full **candidates** table (**`/admin/candidates`**), **scrapers** (**`/admin/scrapers`**), **AI enrichment** (**`/admin/enrichment`**), and **Public Pulse** admin (**`/admin/pulse`**) — see **§0** and **§7**. **`POST /api/admin/generate-topics`** wires **`scripts/generate-topics.ts`**. **`ADMIN_SECRET` is not used.** **`src/lib/admin-auth.ts`** (legacy HMAC cookie) is **unreferenced** but may remain on disk. **RLS** is **on** in Supabase for six public tables (`issue_votes`, `candidate_ratings`, `pulse_insights`, `topic_summaries`, `topic_upvotes`, `topic_feedback`); the app’s **`DATABASE_URL`** connection **bypasses** RLS — policies protect direct **PostgREST / `anon` key** use only. **`npm run build` succeeds** when `DATABASE_URL` and `NEXT_PUBLIC_SITE_URL` are set; listing pages may tolerate a **down database at build time** via try/catch fallbacks.

---

## 2. File Tree

```
48-Jersey2026/
├── .claude/ …
├── .env.example
├── .gitignore
├── .npmrc
├── data/candidates.json
├── docs/CODEBASE-REPORT.md
├── drizzle/
│   ├── 0000_enable_pgcrypto.sql
│   ├── 0001_enable_rls_public_tables.sql
│   └── 0002_add_social_links.sql
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── public/ …
├── railway.json
├── README.md
├── scripts/
│   ├── bootstrap-env.ts
│   ├── cron.ts
│   ├── generate-pulse-insight.ts
│   ├── enrich.ts
│   ├── enrich-articles.ts
│   ├── import-local-scrapes.ts
│   ├── ingest-news.ts
│   ├── extract-social-links.ts
│   ├── discover-social-links.ts   # extra social URLs from manifesto when social_links empty
│   ├── scrape-social.ts           # Firecrawl + Grok merge (facebook/website/linkedin)
│   ├── validate-social-links.ts
│   ├── seed-candidates.ts
│   └── scrapers/
│       ├── scrape-flow-je.ts
│       ├── scrape-vote-je.ts
│       ├── scrape-vote-je-manifestos.ts
│       └── …
├── tailwind.config.ts
├── tsconfig.json
├── wrangler.toml
└── src/
    ├── middleware.ts                 # CVE header check + updateSession → src/lib/supabase/middleware
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── robots.ts
    │   ├── sitemap.ts
    │   ├── about/page.tsx
    │   ├── trends/ (page.tsx, pulse-client.tsx)
    │   ├── admin/
    │   │   ├── layout.tsx              # minimal shell (no auth — avoids /admin/login loop)
    │   │   ├── (protected)/layout.tsx, page.tsx
    │   │   ├── (protected)/candidates/ (page.tsx, candidates-table.tsx, actions.ts)
    │   │   ├── (protected)/scrapers/ (page.tsx, scrapers-client.tsx)
    │   │   ├── (protected)/enrichment/ (page.tsx, enrichment-client.tsx)
    │   │   ├── (protected)/pulse/ (page.tsx, pulse-admin-client.tsx)
    │   │   ├── login/page.tsx, login/actions.ts
    │   │   └── admin-legacy-panel.tsx, admin-dashboard.tsx
    │   ├── compare/ (page.tsx, compare-client.tsx, comparison-table.tsx)
    │   ├── api/
    │   │   ├── admin/* (login, logout, health, candidates, re-enrich, enrich-batch, generate-topics, run-scraper, clear-pulse, regenerate-insight, …)
    │   │   ├── pulse/ (vote GET+POST, results, rate, insight)
    │   │   ├── compare/route.ts
    │   │   ├── topics/[issue]/ (route, upvote, feedback)  # Policy Intelligence
    │   │   ├── og/route.tsx        # next/og ImageResponse — Node; ?slug= candidate card
    │   │   ├── health/route.ts
    │   │   ├── districts/ …
    │   │   └── revalidate/route.ts
    │   ├── candidates/ …
    ├── components/ (navbar, logo, **issue-intelligence**, **issue-sheet**, seenovate-footer-credit, about-actions, social-links, admin/*, …)
    ├── db/ (index, schema, migrate, seed, seed-candidates)
    └── lib/ (env, grok, firecrawl, rate-limit, pulse-insight, **social-links**, brand-metadata, **admin-guard** (Supabase), **supabase** — `server.ts`/`client.ts` re-export `utils/supabase/`, `middleware.ts` for root middleware, **admin-auth.ts** legacy unused, validate, …)
```

**⚠️ Incomplete / missing relative to target architecture**

- `scripts/scrapers/scrape-policy-je.ts` — **not present** (no `scrape:policy` script) — may still be commented in `cron.ts`.
- Tailwind **v4** + `@theme` + Untitled UI packages — **not present**.
- Candidate **`opengraph-image`** — **may still exist** under `candidates/[slug]/`; **primary social preview** is **`/api/og?slug=…`** in **`generateMetadata`** (and root **`/api/og`** for the site default).
- Supabase **RLS** — **enabled in production DB**; policy SQL is **not** checked into `drizzle/` (documented in **§4** / **§0** — replicate in SQL Editor for new projects).

**📝 TODO comments in TS/TSX:** none found.

---

## 3. Untitled UI & Design System Audit

| Question | Answer |
|----------|--------|
| Untitled UI initialised? | **No.** No `@untitledui/*`, no `untitledui` import layer, no RouteProvider. |
| RouteProvider (App Router)? | **N/A** (Untitled UI not used). |
| Untitled UI components in use? | **None** — custom Tailwind + semantic tokens. |
| Components that “should” be Untitled UI? | **Admin login** is a **server** page with native `<input>` + Tailwind (VotePulse colours). Acceptable until Untitled UI is adopted. |
| Jersey colours in `@theme` (Tailwind v4)? | **No** — project uses **Tailwind 3** `theme.extend.colors` plus `:root` CSS variables in `globals.css`. |
| Hardcoded hex outside tokens? | **Brand metadata:** `src/lib/brand-metadata.ts` (`#A31621` for viewport metadata parity). **Config:** `tailwind.config.ts` defines palette hexes (canonical source for utilities). **CSS variables:** `globals.css` `:root` uses hex (canonical for semantic vars). **Charts:** now use `var(--chart-sentiment-*)` mapped to existing vars. |
| Archivo loaded? | **Yes** — `next/font/google` Archivo in `src/app/layout.tsx`, `--font-archivo` on `<html>`. **OG image route** uses **`@fontsource/archivo`** WOFF files (see **`src/app/api/og/route.tsx`**) for Satori — separate from the layout font. |
| Full 11-step brand/warning/gray scales? | **No** — practical subset only (`jersey-red`, `gold`, `navy`, `surface`, `on-primary`, `success`, semantic aliases). |
| Dark mode? | **Not implemented** (`[data-theme="dark"]` absent). |
| Buttons / cards / badges | Public CTAs use `bg-jersey-red` + `text-on-primary`. AI blocks use gold border treatment. **Not** Untitled UI Button primitives. |

---

## 4. Database Schema

**Tables (Drizzle `src/db/schema.ts`):**

| Table | Columns (summary) | Constraints / indexes |
|-------|-------------------|------------------------|
| `candidates` | id uuid PK default `gen_random_uuid()`, name, slug, district, party, photo_url, bio, manifesto_raw/url, **`social_links` jsonb** (optional `Record<string,string>` — handles/URLs; UI via `buildSocialLinks` in `src/lib/social-links.ts`), **ai_summary**, **`ai_issues` jsonb** (issue stances for UI/compare — **authoritative** for `/compare` when present), source_urls text[] default `{}`, data_hash, last_scraped_at, last_enriched_at, created_at, updated_at | Unique `slug`; index `district` |
| `articles` | id, title, source, url, published_at, content_raw/hash, candidate_mentions uuid[], ai_sentiment, ai_summary, created_at | Unique `url`; index `published_at` |
| `issues` | id, name, display_name, description, icon | Unique `name` |
| `candidate_issues` | candidate_id FK → candidates, issue_id FK → issues, position, source_quote, confidence, created_at | PK (candidate_id, issue_id); may be **empty** — enrichment can populate; **public compare** reads **`candidates.ai_issues`** |
| `snapshots` | id, entity_type, entity_id, data jsonb, captured_at | Index (entity_type, entity_id); index captured_at |
| `issue_votes` | id, issue, voter_fingerprint, created_at | Indexes on issue, fingerprint — **Public Pulse** issue poll |
| `candidate_ratings` | id, candidate_id FK, rating 1–5, voter_fingerprint, created_at | **Public Pulse** star ratings |
| `pulse_insights` | id, insight_type, content, sources jsonb optional, generated_at | Cached **Analysis** text (`issue_summary` / legacy `issue_analysis`) |
| `topic_summaries` | id, **issue** (unique), display_name, icon, **ai_summary**, **candidate_count**, **top_parties** / **sources_cited** jsonb, generated_at, updated_at | **Policy Intelligence** — one row per canonical issue (housing … public_services); refreshed by `generate:topics` / enrichment |
| `topic_upvotes` | id, **issue**, **fingerprint**, created_at | Unique **`(issue, fingerprint)`** — anonymous topic upvotes |
| `topic_feedback` | id, issue, feedback_type, content, fingerprint, created_at | Anonymous feedback per topic |

**Connection:** `src/db/index.ts` uses `postgres(DATABASE_URL, { prepare: false, max: … })` — suitable for **Supabase pooler**. **`sql` export** (postgres-js tagged template) is also used for the homepage live **`ai_issues`** aggregation in `issue-intelligence.tsx`.

**RLS:** **Enabled in Supabase** (not in `drizzle/*.sql`) on **`issue_votes`**, **`candidate_ratings`**, **`pulse_insights`**, **`topic_summaries`**, **`topic_upvotes`**, **`topic_feedback`** — `anon` **SELECT** on the first five; **no** `anon` policy on **`topic_feedback`**. The Next.js app uses **`DATABASE_URL`** and **bypasses** RLS; policies matter for **PostgREST / `anon` key** access only. Re-apply the same SQL when cloning the project.

**Migrations:** Bootstrap SQL in **`drizzle/0000_*.sql` … `0002_add_social_links.sql`** runs via **`npm run db:migrate`** (`src/db/migrate.ts`). **`candidates.social_links`** is added in **`0002_add_social_links.sql`**. If **`drizzle-kit push`** fails during introspection (known **`checkValue.replace`** bug on some DBs), use **`db:migrate`** or apply equivalent DDL in Supabase. Also ensure **`issue_votes`**, **`candidate_ratings`**, **`pulse_insights`** exist if using Public Pulse.

---

## 5. Authentication & admin access

| Item | Status |
|------|--------|
| **Admin panel** | **Supabase Auth** — `signInWithPassword` in **`src/app/admin/login/actions.ts`**; session in **HttpOnly** cookies via **`@supabase/ssr`**. No **`ADMIN_SECRET`**. **Dashboard** (`/admin`, **`(protected)/page.tsx`**) — `dynamic = 'force-dynamic'`, live stats (candidates, AI fields, topic tables, enrichment %, last enriched). |
| `src/lib/admin-guard.ts` | **Yes** — `createServerClient` + **`getUser()`**; returns **401** if no user. Used by `POST/GET` admin API routes (health, enrich, etc.). |
| `src/lib/admin-auth.ts` | **Legacy / unused** — HMAC `votepulse_admin` cookie; **not imported** after Phase 9. Safe to delete in a later cleanup. |
| Supabase packages | **`@supabase/ssr`**, **`@supabase/supabase-js`**; **`src/lib/supabase/server.ts`** and **`client.ts`** re-export **`src/utils/supabase/*`** (shared env helpers). |
| `src/middleware.ts` | **Yes** — blocks **`x-middleware-subrequest`** (CVE mitigation); calls **`updateSession`** from **`src/lib/supabase/middleware.ts`** (session refresh + `/admin/*` and `/api/admin/*` gating). |
| `/admin/login` | **Server** page — `action={login}`; errors via **`?error=`** query. Legacy **`POST /api/admin/login`** returns **410**. |
| Protected admin | **Layer 1:** middleware redirects unauthenticated users from `/admin/*` (not `/admin/login`) to login. **Layer 2:** **`src/app/admin/(protected)/layout.tsx`** calls **`getUser()`** + **`redirect`**. **Layer 3:** `requireAdmin` on API routes. |
| **Navbar “Admin”** | **`src/components/admin-nav-button.tsx`** (server) — rendered only if **`getUser()`** succeeds; passed into client **`Navbar`** as **`adminButton`**. |
| **Logout** | **`POST /api/admin/logout`** — `supabase.auth.signOut()`; **AdminNav** client fetches then **`window.location = /admin/login`**. |
| Public routes | **No login** for voters. |
| **Public Pulse cookie** | **`vp_voted`** (httpOnly) for issue vote; not admin auth. |

---

## 6. API Routes (non-exhaustive)

| Method | Path | Purpose | Auth / notes |
|--------|------|---------|----------------|
| GET | `/api/health` | DB + optional cron state | Public |
| GET | `/api/compare` | **2–4 UUIDs** in `?ids=`. Response: `candidates[]` with `aiIssues`, `aiSummary`, `bio`, `photoUrl`, `manifestoUrl`, `sourceUrls`, `manifestoRaw`, etc. **400** if not UUID or wrong count. | Public |
| GET | `/api/og` | **1200×630 PNG** social card. **`?slug=`** → DB lookup; missing/unknown → fallback. **`type=home` or no slug** → site card. **Node** route (not edge). | Public; CDN via **`s-maxage=21600`** in `next.config.ts` |
| POST | `/api/revalidate` | ISR | `REVALIDATION_SECRET` |
| GET/POST | `/api/pulse/vote` | Issue vote; **GET** returns `{ hasVoted }` from cookie | Rate limit; cookie `vp_voted` |
| GET | `/api/pulse/results` | Poll + rating aggregates | Public |
| GET | `/api/pulse/insight` | **DB-only** latest insight (no LLM) | Public |
| POST | `/api/pulse/rate` | Candidate rating | Rate limit as wired |
| POST/GET | `/api/admin/*` (except legacy login) | Scrapers, **re-enrich**, **enrich-batch**, **generate-topics** (`scripts/generate-topics.ts`), **clear-pulse**, **regenerate-insight**, health, etc. | **`requireAdmin`** (Supabase session) — unauthenticated **401**; middleware also returns **401** for `/api/admin` without user |
| POST | `/api/admin/login` | **Deprecated** | **410** — use `/admin/login` + server action |
| POST | `/api/admin/logout` | `signOut()` | **Session** required for meaningful sign-out; returns JSON **{ ok: true }** |
| GET | `/api/districts`, `/api/districts/[district]` | District listings | Public |
| GET | `/api/topics/[issue]` | Topic summary + candidates with `ai_issues` stance for that issue | Public |
| POST | `/api/topics/[issue]/upvote` | Insert upvote; dedupe by issue + fingerprint; returns total | Public |
| POST | `/api/topics/[issue]/feedback` | Anonymous feedback row | Public |
| … | … | See `src/app/api/` for full list | — |

**Rate limiting:** `checkRateLimit` in `src/lib/rate-limit.ts` (requires **`REDIS_URL`** + ioredis for enforcement).

---

## 7. Pages & UI

| Route | Data source | Rendering | Status |
|-------|-------------|-----------|--------|
| `/` | **`IssueIntelligence`** + hero + how-it-works; `topic_summaries` + upvotes + raw SQL on **`ai_issues`**; fallback if SQL fails | Server, `revalidate = 21600` (6h) | OK |
| `/candidates` | Drizzle list + **4 aggregate queries** (`districtCounts`, `totalEnriched`, `independentCount`, `partyBreakdown`); **AEO capsule** `#aeo-answer-capsule` above grid; **speakable** `ItemList` JSON-LD | Server, ISR 6h | OK |
| `/candidates/[slug]` | Drizzle by slug; `generateStaticParams` (fallback `[]`); hero **`SocialLinks`**; **`id="aeo-candidate-lead"`** on amber AI card (speakable); **`has2026Content`** manifesto notice; **OG/Twitter** images → **`/api/og?slug=`** | Server, ISR 6h | Dynamic at runtime if not prebuilt |
| `/compare` | Server: candidate list (filters). **Client:** `GET /api/compare?ids=` → **`ComparisonTable`** (issue grid from **`ai_issues`**) | Hybrid | OK |
| `/districts/[district]` | District list + **`districtStats` query** (total, withSummary, parties); **AEO capsule** `#aeo-district-answer` above `<DistrictTable>` | Server, ISR 5m | OK |
| `/trends` | Candidates list + **PublicPulseClient** (poll, ratings, results fetch) | Server + client | **Insight** from `GET /api/pulse/insight` (DB) |
| `/about` | Static copy + **about-actions** (client) for mail & BMC buttons | Server + client islands | OK |
| `/admin` | Drizzle + dashboard; **`(protected)/layout`** + middleware | Server | OK (Supabase session) |
| `/admin/candidates` | All candidates, stats, **`CandidatesTable`** + **`reEnrichCandidate`** | Server + client | OK |
| `/admin/scrapers` | Last-scrape stats + **`ScrapersClient`** → run-scraper | Server + client | OK |
| `/admin/enrichment` | Enrichment metrics + batch / generate-topics / insight buttons | Server + client | OK |
| `/admin/pulse` | Vote aggregates + latest insight + **`PulseAdminClient`** | Server + client | OK |
| `/admin/login` | Branded form; **`login` server action** | Server | OK (no `ADMIN_SECRET`) |
| `/sitemap.xml` | `NEXT_PUBLIC_SITE_URL` only | Metadata route | OK |
| `/robots.txt` | Same | Metadata route | OK |

**Shared components (high level)**

- **`Navbar`** — client; **`NAV_LINKS`**; optional **`adminButton`** (server slot: **`AdminNavButton`**); **mobile** drawer in same component (no `nav-mobile.tsx`).
- **Footer** — **`FOOTER_NAV_LINKS`** in **`layout.tsx`**, same six links as navbar.
- `CandidateGrid`, `CompareClient`, **`ComparisonTable`**, **`PublicPulseClient`** (`trends/pulse-client.tsx`), `ManifestoExpander` — feature-specific clients.
- Global **footer** in `layout.tsx` + `SeenovateFooterCredit`.
- `Crest` / `Logo` — see `components/`.

---

## 8. Scripts & Automation

| Script | Purpose | Run command | Status |
|--------|---------|-------------|--------|
| `cron.ts` | Schedules 6h / 2h / daily jobs; **`socialScrapeCycle()`** at **06:00 `Europe/London` daily** (`discover-social-links` → `scrape-social` → revalidate); **includes** `scripts/generate-pulse-insight.ts` in 6h cycle; **one-off yearly job** **27 Apr 08:00 `Europe/London`** (manifestos → flow → import → extract social → enrich batch → revalidate); SIGINT/TERM → `process.exit(0)` | `npm run cron` | OK |
| `generate-pulse-insight.ts` | Calls `generatePulseInsight()` from `src/lib/pulse-insight.ts` | Invoked by cron (and can be run manually) | OK |
| `bootstrap-env.ts` | Loads `.env.local` first; imported by `enrich*.ts` | (side-effect import) | OK |
| `enrich.ts` | Candidate AI enrichment (Grok) | `npm run enrich` | OK |
| `enrich-articles.ts` | Article enrichment (Grok) | `npm run enrich:articles` | OK |
| `ingest-news.ts` | News ingest | `npm run ingest:news` | OK |
| `import-local-scrapes.ts` | **`data/flow.je/*.json`** → **`candidates`** (bio/manifesto extractors; clears AI fields on update) | `npm run import:local` or `import:local-scrapes` | OK |
| `extract-social-links.ts` | Parse manifesto text → `candidates.social_links` | `npm run extract:social` | OK |
| `discover-social-links.ts` | Regex pass on `manifesto_raw` for URLs when `social_links` null/empty | `discover:social` / `discover:social:dry` | OK |
| `scrape-social.ts` | `scrapeUrl` + `grokChatCompletionJson` — merge policy into `ai_issues` / `ai_summary` | `scrape:social` / `*:dry` / `scrape:social:force` | OK |
| `validate-social-links.ts` | Audit: how many candidates get ≥1 URL from `buildSocialLinks()` | `npm run validate:social` | OK |
| `seed-candidates.ts` | Seed candidates | `npm run seed` / `seed:candidates` | OK |
| `seed-topics.ts` / `generate-topics.ts` | **`topic_summaries`** seed + Grok refresh | `npm run seed:topics`, `generate:topics` | OK |
| `scrape-flow-je.ts` | flow.je | `npm run scrape:flow` | OK |
| `scrape-vote-je.ts` | vote.je | `npm run scrape:vote` | OK |
| `scrape-vote-je-manifestos.ts` | Map + scrape vote.je URLs filtered for **`/2026/`**, **`/candidates/`**, etc.; merge longer **`manifesto_raw`** | `npm run scrape:manifestos` | OK (may no-op until pages exist) |
| policy.je scraper | — | **Missing** | ⚠️ |

---

## 9. Environment Variables

| Name | Purpose | Required | Where used |
|------|---------|----------|------------|
| `DATABASE_URL` | Postgres (Supabase pooler URL in prod) | **Yes** (Zod in `src/lib/env.ts`) | Drizzle, all server data routes |
| `NEXT_PUBLIC_SITE_URL` | Canonical / OG base | **Yes** (default localhost in Zod) | `layout`, metadata, cron, revalidate redirect |
| `SKIP_DB_HEALTHCHECK` | Skip DB in `/api/health` | No | `api/health`, `env.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | **Yes** for admin sign-in + session refresh | Middleware, `createServerClient` / browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (or publishable) key | **Yes** for admin | Same (`utils/supabase/env.ts` accepts `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | Elevated API (scripts / server-only) | Optional unless a path uses service role | Server scripts; not required for cookie-based admin UI |
| `DIRECT_URL` | Drizzle migrate direct port | Optional | Documented in `.env.example` |
| `GROK_API_KEY` / `XAI_API_KEY` | xAI Grok enrichment | For scripts | `scripts/enrich*.ts`, `src/lib/grok.ts` |
| `GROK_MODEL` | Grok model id | Optional (default in code: **`grok-4-1-fast-reasoning`**) | `src/lib/grok.ts`, `scripts/enrich*.ts` |
| `FIRECRAWL_API_KEY` | Scraping | For scripts | Scrapers / cron |
| `FIRECRAWL_DAILY_CREDIT_LIMIT` | Credit guard | Optional | Scripts |
| `REVALIDATION_SECRET` | POST `/api/revalidate` | For webhook-style revalidation | `api/revalidate`, `cron.ts` |
| `REDIS_URL` | Standard Redis URL (ioredis) | Optional; without it, `checkRateLimit` **allows** all traffic | `src/lib/rate-limit.ts`, API routes using it |
| ~~`ADMIN_SECRET`~~ | **Removed (Phase 9)** | Do not set | Replaced by Supabase sessions |

---

## 10. Deployment Readiness

### Cloudflare Pages

- **Current Next config:** default Node server (`next build` / `next start`), **not** `output: 'export'`.
- **`wrangler.toml`:** Added stub pointing at `.vercel/output/static` for **`@cloudflare/next-on-pages`** workflow — you must align **build command** and **output dir** with the adapter version you choose.
- **Edge:** Database-bound routes expect **Node runtime** (`/api/*` sets `nodejs` where needed). Full edge parity is **not** verified.

### Railway

- **`railway.worker.json`:** worker **Start** is `npx tsx scripts/cron.ts` (not always the same as web `railway.json`).

### Supabase

- **Schema:** push/migrate via Drizzle.
- **Auth:** enable Email provider; create admin users in dashboard.
- **RLS:** **enabled** in Supabase for the six public tables above (see **§4**). Still use **server + `DATABASE_URL`** for app writes; RLS is defense-in-depth for the Data API.

---

## 11. Issues Found

### 🔴 Critical (blocks build/deploy)

1. **`npm install` peer conflict (React RC + drizzle)** — mitigated with **`.npmrc` → `legacy-peer-deps=true`**.
2. **`node-cron` typings** — fixed with **`@types/node-cron`**.
3. **`trends/page.tsx` + Drizzle `execute` typing** — fixed by iterating `RowList` correctly.
4. **`robots.ts` / `sitemap.ts` importing `env`** — caused build failure without `DATABASE_URL`; fixed by using **`process.env.NEXT_PUBLIC_SITE_URL`** only.
5. **Build-time DB connection** — `generateStaticParams` and server pages failed without Postgres; fixed with **targeted try/catch fallbacks** (build-friendly; production should still use a real DB).

### 🟡 Warning (should fix before launch)

1. **Next.js 15.0.3** — npm reports a **security advisory**; upgrade to a patched minor when feasible.
2. **No `scrape-policy` / policy.je pipeline** — cron state references it but script is absent.
3. **No dynamic `sitemap` entries** for each candidate URL yet.
4. **Cloudflare + Postgres** — confirm adapter supports your DB access pattern (often **not** edge-compatible for raw TCP).
5. **`drizzle-kit push`** — may throw on some Postgres **`CHECK`** introspection; prefer **`npm run db:migrate`** for `drizzle/*.sql` bootstrap.
6. **Cron `0 8 27 4 *`** — fires **every year** on 27 April; update or remove if the official list date changes.
7. **Wikipedia handles in `social_links`** — markdown-escaped underscores (`\_`) may need manual cleanup if **`buildSocialLinks`** URLs 404.

### 🔵 Info (nice to have)

1. **Home / global** default OG is **`/api/og`** (no query) in root metadata; per-candidate uses **`/api/og?slug=…`**. A separate **`opengraph-image`** route under **`candidates/[slug]`** may still exist for tooling; primary sharing tags use **`/api/og`**.
2. **`npm audit`** — address moderate/high findings when upgrading deps.
3. Consider **`pnpm`** lockfile consistency (README historically mentioned pnpm).

### 🎨 Design consistency (addressed in this pass)

- **Public Pulse** (`pulse-client.tsx`) uses **inline bars** for issue percentages (VotePulse palette hex in component). Legacy sentiment **`trends-client.tsx`** removed when `/trends` became Public Pulse; any remaining **`var(--chart-sentiment-*)`** usage is elsewhere (e.g. `globals.css`).
- Removed compare table **`#fff` / rgba** sticky cell inline styles → **`bg-white` / `bg-surface/40`**.
- **Crest SVG** → Tailwind **`fill-*`** utilities.
- **Home hero grid** → **`var(--color-on-primary)`** lines.
- **Card hover shadows** in trends / candidates → **`shadow-card` / `shadow-card-hover`**.
- **Viewport theme colour** → **`brand-metadata.ts`** single constant aligned with tokens.

**Remaining intentional hex sources:** `tailwind.config.ts`, `globals.css` `:root`, `brand-metadata.ts` (metadata).

---

## 12. Deployment Checklist

- [x] TypeScript compiles (`npx tsc --noEmit`)
- [ ] Untitled UI initialised (not in scope of current repo)
- [x] Jersey palette defined (Tailwind 3 + CSS vars — not full 11-step scales)
- [x] Archivo via Google Fonts
- [x] No stray chart/table hex in components (canonical hex remains in token sources)
- [x] Supabase Auth wiring for admin (env-dependent)
- [x] Middleware protects `/admin` except `/admin/login`
- [x] Public routes require no login
- [x] Database migrated on Supabase; **`social_links`** via **`0002_add_social_links.sql`**; **RLS** on six public tables (see **§4**) — apply in SQL Editor, not in `drizzle/`
- [x] `.env.example` expanded
- [x] `wrangler.toml` + `railway.json` stubs
- [x] No `localhost` in committed runtime config (only examples in docs / defaults)
- [x] ISR `revalidate` set on key routes
- [x] AI disclaimers on summaries / trends / home
- [x] Source URLs on candidate profiles (`sourceUrls`)
- [ ] Manual responsive QA
- [x] Per-candidate social preview: **`/api/og?slug=…`** in `generateMetadata`; optional **`opengraph-image`** under `candidates/[slug]`; home default **`/api/og`**
- [x] `sitemap.xml` route
- [x] `robots.txt` route
- [x] `/api/health`
- [x] Focus styles on admin login inputs (gold ring on `/admin/login`; legacy panels may use `ring-jersey-red`)
- [ ] **`REDIS_URL`** on web (and worker if same code path) when rate limits must be enforced
- [x] Public Pulse insight generated on schedule + admin regenerate; not on `GET /api/pulse/insight`
- [x] **`/compare`** deep table + **`GET /api/compare`** + **`ai_issues` JSONB** docs (§0, §6–7, **§13**)

---

## 13. Auditor / LLM review checklist

Use for security, privacy, DPA, product accuracy, and **LLM-onboarding** (so models do not use the wrong table or API).

### Security, privacy, operations

| # | Check |
|---|--------|
| 1 | **`REDIS_URL`:** In production, confirm it is set if you rely on rate limits; if unset, `checkRateLimit` **fails open** (allows requests). |
| 2 | **Public Pulse — insight:** `GET /api/pulse/insight` must **not** call Grok; generation only in **`generatePulseInsight`** (cron + admin **regenerate-insight**). |
| 3 | **Public Pulse — votes:** Cookie `vp_voted` + 24h fingerprint; **409** when already voted; **`GET /api/pulse/vote`** exposes cookie state for UI. Confirm matches product copy. |
| 4 | **Admin APIs:** All mutation routes use **`requireAdmin`** (Supabase **`getUser()`** on the request). Middleware also returns **401** for `/api/admin/*` without a session. No **`ADMIN_SECRET`**. |
| 5 | **About / privacy copy:** “No cookies / no analytics” claims — **reconcile** with **`layout.tsx`** (**GA4** + **Microsoft Clarity**), pulse/**Supabase session** / admin cookies, and **`vp_voted`**. |
| 6 | **Candidate pages:** Only one **`SocialLinks`** block in hero. **`buildSocialLinks()`** must stay **XSS-safe** (only known platforms; `new URL()` validation) — treat `social_links` as **untrusted** DB text. Run **`npm run validate:social`** after bulk imports. |
| 7 | **Worker `cron.ts`:** Long-running; must **not** use synchronous **`process.exit(0)`** at end of file; shutdown is **SIGINT/SIGTERM**. |
| 8 | **Data subjects:** About + mailto for correction/removal — operational process matches copy. |
| 9 | **Third-party links:** Seenovate footer UTM params; Buy Me a Coffee external flow. |
| 10 | **Drizzle:** `issue_votes`, `candidate_ratings`, `pulse_insights` — migrations applied per environment. |
| 11 | **`ioredis`:** Server-side Redis URL for `checkRateLimit`; not Upstash REST for this path. |

### Compare, AI data & election integrity

| # | Check |
|---|--------|
| 12 | **`/compare` reads `candidates.ai_issues` (JSONB).** The **`candidate_issues`** table may be **empty**; do not use it as the source of truth for the compare grid unless the app is refactored. |
| 13 | **`GET /api/compare?ids=`** — **2–4 UUIDs**, **camelCase** JSON, **400** on invalid ids/count, order preserved. `src/app/api/compare/route.ts`. |
| 14 | **AI disclaimers** remain on compare (footer) and anywhere stances appear. |
| 15 | **Grok** for enrichment only — no Anthropic SDK; **`GROK_API_KEY` / `XAI_API_KEY`** never in git. |
| 16 | **`import-local-scrapes`** vs **`seed-candidates`:** bulk Firecrawl import vs `data/candidates.json` — different entry points. |
| 17 | **Post-import:** Run **`npm run extract:social`** after **`import:local`** or scrapers so **`social_links`** is populated; hero **`SocialLinks`** reads JSONB only. |
| 18 | **`scrape:manifestos`:** Uses **Firecrawl credits** per URL; safe to run when vote.je has no 2026 pages (early exit / few matches). |
| 19 | **`import-local-scrapes` extractors:** Regressions can put election tables back into **`bio`** or **`manifesto_raw`** — audit diffs when changing **`extractBio` / `extractManifesto`**. |

### LLM coding guardrails (short)

- **AEO capsules:** The `<section id="aeo-answer-capsule">` / `#aeo-district-answer` blocks and **`#aeo-candidate-lead`** on the candidate page must remain **server-rendered static HTML** — no client components, no `useState`/`useEffect` inside them. CSS selectors in `speakable` JSON-LD must match the `id` attributes exactly (candidate page: **`#aeo-candidate-lead`** only in `candidate-jsonld.ts`). Do not rename without updating `candidate-jsonld.ts` and the inline `<script>` in `candidates/page.tsx`.
- **Admin auth:** Do not reintroduce **`ADMIN_SECRET`** or cookie HMAC; use **Supabase** + **`requireAdmin`**. New admin pages belong under **`src/app/admin/(protected)/`** unless intentionally public (e.g. login). **Server actions** for admin must verify the user (e.g. **`createClient()`** + `getUser()`) because **`requireAdmin` expects a `NextRequest`**. For **`pulse_insights`**, use schema columns **`insight_type`**, **`content`**, **`generated_at`** (not `type` / `created_at`). **`POST /api/admin/run-scraper`** body field is **`scraperName`**, not `scraper`.
- **AEO aggregate queries:** The four queries in `CandidatesPage` (`districtCounts`, `enrichedCountRows`, `partyBreakdown`, and the derived `independentCount`) use **`count`, `sql`, `ne`, `isNotNull`** from `drizzle-orm` with camelCase field names. Adding filters must preserve the `ne(candidates.district, "Unknown")` guard.
- **Speakable schema:** The `WebPage` + `speakable` node is in **`src/lib/candidate-jsonld.ts`** for candidate pages, and an **inline `<script>`** in **`src/app/candidates/page.tsx`** for the listing page. The district page does **not** yet have a speakable `<script>` — the AEO capsule HTML alone is sufficient.
- **Issues on compare:** Use **`candidates.ai_issues`** (or API response), **not** only **`candidate_issues`**.
- **Public Pulse:** Do **not** add Grok or Firecrawl to **`GET /api/pulse/insight`**; keep **`generatePulseInsight()`** as the only writer of `issue_summary` rows (plus any legacy `issue_analysis` reads).
- **Social links:** Extend **`src/lib/social-links.ts`** (`PLATFORM_CONFIG` + `buildSocialLinks`) for new platforms; keep **`SocialLinks`** as the only hero social UI; use **`validate:social`** to regression-check DB content. **`extract-social-links.ts`** is the writer to **`social_links`** — not the importer alone.
- **Manifesto import:** **`extractManifesto`** must keep **`cleanMarkdown` before global link-stripping** so leading flow.je nav is removed.
- **Windows builds:** If **`next build`** fails with missing chunks / ENOENT renames, delete **`.next`** and rebuild once.
- **Enrichment changes:** Coordinate **`src/lib/grok.ts`**, **`scripts/enrich.ts`**, **`scripts/enrich-articles.ts`** when defaults change.
- **Gates:** `npx tsc --noEmit` and `npm run build` after substantive edits.
- **OG / social cards:** Do **not** set **`runtime = "edge"`** on **`/api/og`**. Use **`?slug=`** in candidate metadata, not **`?title=`** / old query shape. Keep **`@fontsource/archivo`** WOFF (not WOFF2) for Satori in this build.

---

## Appendix — Commands verified (26 Apr 2026)

- `npx tsc --noEmit` — **pass** (through Phase 9 — Supabase admin auth; admin subpages + `generate-topics` route)
- `npm run build` — **pass** (~179 routes; includes admin route group, `/api/admin/generate-topics`)
- **Admin auth (local):** unauthenticated `GET /admin` → **307** to `/admin/login?redirectTo=…`; `GET /admin/login` → **200** with email/password form; unauthenticated `GET /api/admin/health` → **401**
- **`GET /api/og`** — 200 + `image/png` when dev server is up; candidate HTML includes `og:image` / `twitter:image` with **`/api/og?slug=…`**
- **AEO capsule HTML** (`/candidates`): `id="aeo-answer-capsule"` present in static HTML; `id="aeo-lead"` paragraph shows real DB counts (135 candidates, 46 Independents, 14 districts); 83 AI summaries shown in stat grid; 21 `<li>` district links rendered
- **Speakable JSON-LD** (`/candidates`): `SpeakableSpecification` count = 2 (present in raw HTML)
- **AEO / speakable** (`/candidates/alan-beadle`): `id="aeo-candidate-lead"` present on amber summary block; JSON-LD **`speakable.cssSelector`** lists **`#aeo-candidate-lead`** only (no `#aeo-candidate-answer`)
- **AEO capsule** (`/districts/St%20John`): `id="aeo-district-answer"` + `id="aeo-district-lead"` present with real candidate count (2) from DB
- **`/candidates` meta description** verified: starts with "Jersey's 2026 general election (7 June 2026) has 135 declared candidates…"
- **`/candidates/alan-beadle` meta description** verified: starts with "Alan Beadle is standing in St Brelade in Jersey's 2026 general election on 7 June 2026 as an Independent."
