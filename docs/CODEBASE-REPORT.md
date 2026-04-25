# VotePulse — Codebase Report

**Generated:** 23 April 2026  
**Last documentation sync:** 25 April 2026 — **Phase 7: dynamic social OG** (`/api/og` — `next/og` / Satori, Node runtime, per-candidate cards via `?slug=`), `@fontsource/archivo` WOFF + **`next.config.ts`** Cache-Control on `/api/og`; also Public Pulse, **`social_links`** + **`buildSocialLinks`**, **`extract:social`** / **`validate:social`**, **`scrape:manifestos`**, **`import-local-scrapes`** heuristics, **`has2026Content`**, compare/API docs, **§13** checklist.

## 0. What changed (recent — for auditors & LLMs)

| Topic | Change |
|-------|--------|
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
| **Mobile nav** | **`src/components/nav-mobile.tsx`** — client hamburger; **`layout.tsx`** depends on it. |
| **Rate limiting** | `src/lib/rate-limit.ts` — **ioredis** + `REDIS_URL`, sliding window per IP; `family: 0` for Railway dual-stack. If `REDIS_URL` is unset, limits are skipped (open). Used by pulse APIs and others as wired. |
| **Public Pulse** | **`/trends`** (nav **“Public Pulse”**): server `src/app/trends/page.tsx` loads candidates; client **`src/app/trends/pulse-client.tsx`** — issue poll, star ratings, `GET /api/pulse/results` every **30s**, Zod issue/rating validation (`src/lib/validate.ts`). Votes: **`vp_voted`** cookie + 24h fingerprint; **`GET`/`POST /api/pulse/vote`**; rate limit when **`REDIS_URL`**. Ratings: **`POST /api/pulse/rate`**. Insight: **`GET /api/pulse/insight` reads `pulse_insights` only** (latest `issue_summary` or `issue_analysis`) — **no Grok on request**. Text generation: `generatePulseInsight()` in **`src/lib/pulse-insight.ts`** via **`scripts/generate-pulse-insight.ts`** in **`scripts/cron.ts` 6h cycle** + **`POST /api/admin/regenerate-insight`**. `POST /api/admin/clear-pulse` clears votes/ratings. |
| **Candidate pages** | Hero **`SocialLinks`**; URLs built in **`src/lib/social-links.ts`** (`buildSocialLinks`) from **`candidates.social_links`** JSONB. |
| **Ops scripts** | **`scripts/extract-social-links.ts`** (`npm run extract:social`) populates `social_links` from manifesto text. **`scripts/validate-social-links.ts`** (`npm run validate:social`) — counts candidates with ≥1 resolvable `buildSocialLinks` URL. |
| **Footer** | `src/components/seenovate-footer-credit.tsx` (client) — Seenovate link + heart hover; included from `src/app/layout.tsx`. Muted text uses **`text-on-primary/50`** on **navy** footer (not light-surface rgba). |
| **About** | `src/app/about/page.tsx` — AI copy references **xAI Grok** (not Claude). **`src/components/about-actions.tsx`** — client buttons (mailto + Buy Me a Coffee hover). |
| **Worker shutdown** | `scripts/cron.ts` — `SIGINT`/`SIGTERM` call `process.exit(0)`; no top-level `process.exit(0)` (would kill the long-running scheduler). |
| **Dependencies** | **ioredis** for Redis rate limiting; **`@fontsource/archivo`** for `/api/og` font data. No Anthropic SDK. |

---

## 1. Project Overview

VotePulse is a public, non-partisan election intelligence site for Jersey’s 2026 general election. It surfaces candidates, AI-assisted manifesto summaries, issue-level comparisons, **Public Pulse** (issue poll + ratings + DB-backed “Analysis” blurb on `/trends`), and news/sentiment views, with source URLs and AI disclaimers emphasised in the UI.

**Tech stack (actual):** Next.js **15** (App Router, TypeScript, ISR on several routes), Tailwind CSS **3.4** (not v4), Drizzle ORM + `postgres` driver, Zod-validated `DATABASE_URL` / `NEXT_PUBLIC_SITE_URL`, **xAI Grok** (OpenAI-compatible HTTP to `api.x.ai`), Firecrawl, RSS ingestion scripts, Supabase-oriented connection settings (`prepare: false` for pooler). **ioredis** for optional Redis rate limits. **Social cards:** per-candidate and default site **`og:image` / `twitter:image`** via **`/api/og`** (`next/og` on the **Node** server, not edge). **Untitled UI is not installed**; the UI is custom Tailwind aligned to a Jersey palette.

**Current state:** Public pages, **compare** (deep table + `ai_issues` from JSONB), **pulse** routes, `src/lib/rate-limit.ts`, API routes listed in §6, and scripts (scrapers, enrich, import-local-scrapes, **generate-pulse-insight**, cron) are implemented. **Admin** uses **`ADMIN_SECRET`** + HTTP-only cookie (`/api/admin/login`, `src/lib/admin-guard.ts`, `src/lib/admin-auth.ts`); middleware also runs **Supabase session** refresh for any Supabase-integrated paths. **RLS policies and SQL migrations beyond Drizzle** are not defined in-repo (operational Supabase work). **`npm run build` succeeds** when `DATABASE_URL` and `NEXT_PUBLIC_SITE_URL` are set; listing pages may tolerate a **down database at build time** via try/catch fallbacks.

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
    ├── middleware.ts
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── robots.ts
    │   ├── sitemap.ts
    │   ├── about/page.tsx
    │   ├── trends/ (page.tsx, pulse-client.tsx)
    │   ├── admin/
    │   │   ├── layout.tsx
    │   │   ├── (protected)/layout.tsx, page.tsx
    │   │   └── login/page.tsx, login-form.tsx
    │   ├── compare/ (page.tsx, compare-client.tsx, comparison-table.tsx)
    │   ├── api/
    │   │   ├── admin/* (login, logout, health, candidates, scrapers, enrich, clear-pulse, regenerate-insight, …)
    │   │   ├── pulse/ (vote GET+POST, results, rate, insight)
    │   │   ├── compare/route.ts
    │   │   ├── og/route.tsx        # next/og ImageResponse — Node; ?slug= candidate card
    │   │   ├── health/route.ts
    │   │   ├── districts/ …
    │   │   └── revalidate/route.ts
    │   ├── candidates/ …
    ├── components/ (navbar, logo, seenovate-footer-credit, about-actions, social-links, admin/*, …)
    ├── db/ (index, schema, migrate, seed, seed-candidates)
    └── lib/ (env, grok, firecrawl, rate-limit, pulse-insight, **social-links**, brand-metadata, admin-*, supabase, validate, …)
```

**⚠️ Incomplete / missing relative to target architecture**

- `scripts/scrapers/scrape-policy-je.ts` — **not present** (no `scrape:policy` script) — may still be commented in `cron.ts`.
- Tailwind **v4** + `@theme` + Untitled UI packages — **not present**.
- Candidate **`opengraph-image`** — **may still exist** under `candidates/[slug]/`; **primary social preview** is **`/api/og?slug=…`** in **`generateMetadata`** (and root **`/api/og`** for the site default).
- Supabase **RLS SQL** — **not in repo**.

**📝 TODO comments in TS/TSX:** none found.

---

## 3. Untitled UI & Design System Audit

| Question | Answer |
|----------|--------|
| Untitled UI initialised? | **No.** No `@untitledui/*`, no `untitledui` import layer, no RouteProvider. |
| RouteProvider (App Router)? | **N/A** (Untitled UI not used). |
| Untitled UI components in use? | **None** — custom Tailwind + semantic tokens. |
| Components that “should” be Untitled UI? | Buttons, inputs on admin login are plain HTML + Tailwind. Acceptable until Untitled UI is adopted. |
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

**Connection:** `src/db/index.ts` uses `postgres(DATABASE_URL, { prepare: false, max: … })` — suitable for **Supabase pooler**.

**RLS:** **Not defined** in this repository (must be added in Supabase SQL or noted as “server-only access” risk if anon keys ever hit DB).

**Migrations:** Bootstrap SQL in **`drizzle/0000_*.sql` … `0002_add_social_links.sql`** runs via **`npm run db:migrate`** (`src/db/migrate.ts`). **`candidates.social_links`** is added in **`0002_add_social_links.sql`**. If **`drizzle-kit push`** fails during introspection (known **`checkValue.replace`** bug on some DBs), use **`db:migrate`** or apply equivalent DDL in Supabase. Also ensure **`issue_votes`**, **`candidate_ratings`**, **`pulse_insights`** exist if using Public Pulse.

---

## 5. Authentication & admin access

| Item | Status |
|------|--------|
| **Admin panel** | **`ADMIN_SECRET`** — user posts password to `POST /api/admin/login`; server sets HTTP-only cookie; `requireAdmin` + `verifyAdminCookie` guard admin API routes. |
| `src/lib/admin-guard.ts` / `admin-auth.ts` | **Yes** — shared with pulse cleanup / regeneration routes. |
| Supabase packages | **`@supabase/ssr`**, **`@supabase/supabase-js`** present; middleware calls **`updateSession`** for session refresh on requests. |
| `src/middleware.ts` | **Yes** — `/admin` paths; admin cookie check + Supabase session forwarding. |
| `/admin/login` | **Yes** — password form → `/api/admin/login`. |
| Protected admin | **Yes** — cookie required for `/admin` app routes and admin APIs. |
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
| POST | `/api/admin/*` | Scrapers, enrich, **clear-pulse**, **regenerate-insight**, etc. | `requireAdmin` (cookie) |
| GET | `/api/districts`, `/api/districts/[district]` | District listings | Public |
| … | … | See `src/app/api/` for full list | — |

**Rate limiting:** `checkRateLimit` in `src/lib/rate-limit.ts` (requires **`REDIS_URL`** + ioredis for enforcement).

---

## 7. Pages & UI

| Route | Data source | Rendering | Status |
|-------|-------------|-----------|--------|
| `/` | Drizzle counts (fallback if DB down at build) | Server, `revalidate = 60` | OK |
| `/candidates` | Drizzle list (fallback `[]`) | Server, ISR 6h | OK |
| `/candidates/[slug]` | Drizzle by slug; `generateStaticParams` (fallback `[]`); hero **`SocialLinks`**; **`has2026Content`** manifesto notice; **OG/Twitter** images → **`/api/og?slug=`** | Server, ISR 6h | Dynamic at runtime if not prebuilt |
| `/compare` | Server: candidate list (filters). **Client:** `GET /api/compare?ids=` → **`ComparisonTable`** (issue grid from **`ai_issues`**) | Hybrid | OK |
| `/trends` | Candidates list + **PublicPulseClient** (poll, ratings, results fetch) | Server + client | **Insight** from `GET /api/pulse/insight` (DB) |
| `/about` | Static copy + **about-actions** (client) for mail & BMC buttons | Server + client islands | OK |
| `/admin` | Supabase session | Server | OK (protected) |
| `/admin/login` | Supabase browser auth | Client form | OK |
| `/sitemap.xml` | `NEXT_PUBLIC_SITE_URL` only | Metadata route | OK |
| `/robots.txt` | Same | Metadata route | OK |

**Shared components (high level)**

- `NavMobile` — mobile drawer (`links` prop).
- `CandidateGrid`, `CompareClient`, **`ComparisonTable`**, **`PublicPulseClient`** (`trends/pulse-client.tsx`), `ManifestoExpander` — feature-specific clients.
- Global **footer** in `layout.tsx` + `SeenovateFooterCredit`.
- `Crest` / `Logo` — see `components/`.

---

## 8. Scripts & Automation

| Script | Purpose | Run command | Status |
|--------|---------|-------------|--------|
| `cron.ts` | Schedules 6h / 2h / daily jobs; **includes** `scripts/generate-pulse-insight.ts` in 6h cycle; **one-off yearly job** **27 Apr 08:00 `Europe/London`** (manifestos → flow → import → extract social → enrich batch → revalidate); SIGINT/TERM → `process.exit(0)` | `npm run cron` | OK |
| `generate-pulse-insight.ts` | Calls `generatePulseInsight()` from `src/lib/pulse-insight.ts` | Invoked by cron (and can be run manually) | OK |
| `bootstrap-env.ts` | Loads `.env.local` first; imported by `enrich*.ts` | (side-effect import) | OK |
| `enrich.ts` | Candidate AI enrichment (Grok) | `npm run enrich` | OK |
| `enrich-articles.ts` | Article enrichment (Grok) | `npm run enrich:articles` | OK |
| `ingest-news.ts` | News ingest | `npm run ingest:news` | OK |
| `import-local-scrapes.ts` | **`data/flow.je/*.json`** → **`candidates`** (bio/manifesto extractors; clears AI fields on update) | `npm run import:local` or `import:local-scrapes` | OK |
| `extract-social-links.ts` | Parse manifesto text → `candidates.social_links` | `npm run extract:social` | OK |
| `validate-social-links.ts` | Audit: how many candidates get ≥1 URL from `buildSocialLinks()` | `npm run validate:social` | OK |
| `seed-candidates.ts` | Seed candidates | `npm run seed` / `seed:candidates` | OK |
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
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | For admin auth | Middleware, Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | For admin auth | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Elevated API (future) | No | Documented only |
| `DIRECT_URL` | Drizzle migrate direct port | Optional | Documented in `.env.example` |
| `GROK_API_KEY` / `XAI_API_KEY` | xAI Grok enrichment | For scripts | `scripts/enrich*.ts`, `src/lib/grok.ts` |
| `GROK_MODEL` | Grok model id | Optional (default in code: **`grok-4-1-fast-reasoning`**) | `src/lib/grok.ts`, `scripts/enrich*.ts` |
| `FIRECRAWL_API_KEY` | Scraping | For scripts | Scrapers / cron |
| `FIRECRAWL_DAILY_CREDIT_LIMIT` | Credit guard | Optional | Scripts |
| `REVALIDATION_SECRET` | POST `/api/revalidate` | For webhook-style revalidation | `api/revalidate`, `cron.ts` |
| `REDIS_URL` | Standard Redis URL (ioredis) | Optional; without it, `checkRateLimit` **allows** all traffic | `src/lib/rate-limit.ts`, API routes using it |
| `ADMIN_SECRET` | Admin cookie HMAC / verification | Required for `/admin` when enabled | `admin-guard`, `admin-auth`, `api/admin/login` |

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
- **RLS:** **to do** before exposing any client-side DB paths (currently app uses server + connection string).

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
- [ ] Database migrated on Supabase + **RLS** designed (including **`social_links`** column — **`0002_add_social_links.sql`**)
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
- [x] Focus styles on admin inputs (`ring-jersey-red`)
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
| 4 | **Admin APIs:** All mutation routes use **`requireAdmin`**; no bypass via client-only checks. |
| 5 | **About / privacy copy:** “No cookies / no analytics” claims — **reconcile** with `layout.tsx` and pulse/admin cookies. |
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

- **Issues on compare:** Use **`candidates.ai_issues`** (or API response), **not** only **`candidate_issues`**.
- **Public Pulse:** Do **not** add Grok or Firecrawl to **`GET /api/pulse/insight`**; keep **`generatePulseInsight()`** as the only writer of `issue_summary` rows (plus any legacy `issue_analysis` reads).
- **Social links:** Extend **`src/lib/social-links.ts`** (`PLATFORM_CONFIG` + `buildSocialLinks`) for new platforms; keep **`SocialLinks`** as the only hero social UI; use **`validate:social`** to regression-check DB content. **`extract-social-links.ts`** is the writer to **`social_links`** — not the importer alone.
- **Manifesto import:** **`extractManifesto`** must keep **`cleanMarkdown` before global link-stripping** so leading flow.je nav is removed.
- **Windows builds:** If **`next build`** fails with missing chunks / ENOENT renames, delete **`.next`** and rebuild once.
- **Enrichment changes:** Coordinate **`src/lib/grok.ts`**, **`scripts/enrich.ts`**, **`scripts/enrich-articles.ts`** when defaults change.
- **Gates:** `npx tsc --noEmit` and `npm run build` after substantive edits.
- **OG / social cards:** Do **not** set **`runtime = "edge"`** on **`/api/og`**. Use **`?slug=`** in candidate metadata, not **`?title=`** / old query shape. Keep **`@fontsource/archivo`** WOFF (not WOFF2) for Satori in this build.

---

## Appendix — Commands verified (25 Apr 2026)

- `npx tsc --noEmit` — **pass**
- `npm run build` — **pass** with `DATABASE_URL` + `NEXT_PUBLIC_SITE_URL` set (DB may be unreachable thanks to fallbacks)
- **`GET /api/og`** — 200 + `image/png` when dev server is up; candidate HTML includes `og:image` / `twitter:image` with **`/api/og?slug=…`**
