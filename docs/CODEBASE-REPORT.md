# VotePulse — Codebase Report

Generated: Thursday, 23 April 2026

## 1. Project Overview

VotePulse is a public, non-partisan election intelligence site for Jersey’s 2026 general election. It surfaces candidates, AI-assisted manifesto summaries, issue-level comparisons, and news sentiment views, with source URLs and AI disclaimers emphasised in the UI.

**Tech stack (actual):** Next.js **15.0.3** (App Router, TypeScript, ISR on several routes), Tailwind CSS **3.4** (not v4), Drizzle ORM + `postgres` driver, Zod-validated `DATABASE_URL` / `NEXT_PUBLIC_SITE_URL`, **xAI Grok** (OpenAI-compatible HTTP to `api.x.ai`), Firecrawl, RSS ingestion scripts, Supabase-oriented connection settings (`prepare: false` for pooler). **Untitled UI is not installed**; the UI is custom Tailwind aligned to a Jersey palette.

**Current state:** Public pages, compare flow, trends sentiment, API routes (`/api/health`, `/api/compare`, `/api/revalidate`), and scripts (scrapers, enrich, cron) are implemented. **Supabase Auth** is wired for `/admin/*` (middleware + login + dashboard shell). **RLS policies and SQL migrations beyond Drizzle** are not defined in-repo (operational Supabase work). **`npm run build` succeeds** when `DATABASE_URL` and `NEXT_PUBLIC_SITE_URL` are set; listing pages tolerate a **down database at build time** via try/catch fallbacks (added in this audit).

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
│   └── 0000_enable_pgcrypto.sql
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── public/favicon.svg
├── railway.json
├── README.md
├── scripts/
│   ├── bootstrap-env.ts
│   ├── cron.ts
│   ├── enrich.ts
│   ├── enrich-articles.ts
│   ├── import-local-scrapes.ts
│   ├── ingest-news.ts
│   ├── seed-candidates.ts
│   └── scrapers/
│       ├── scrape-flow-je.ts
│       └── scrape-vote-je.ts
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
    │   ├── admin/
    │   │   ├── layout.tsx
    │   │   ├── (protected)/layout.tsx, page.tsx
    │   │   └── login/page.tsx, login-form.tsx
    │   ├── api/
    │   │   ├── auth/signout/route.ts
    │   │   ├── compare/route.ts
    │   │   ├── health/route.ts
    │   │   └── revalidate/route.ts
    │   ├── candidates/ …
    │   ├── compare/ …
    │   └── trends/ …
    ├── components/nav-mobile.tsx
    ├── db/ (index, schema, migrate, seed, seed-candidates)
    └── lib/ (env, grok, firecrawl, brand-metadata, supabase/*)
```

**⚠️ Incomplete / missing relative to target architecture**

- `scripts/scrapers/scrape-policy-je.ts` — **not present** (no `scrape:policy` script).
- Tailwind **v4** + `@theme` + Untitled UI packages — **not present**.
- Dedicated OG image route (`opengraph-image.tsx`) — **not present**.
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
| Archivo loaded? | **Yes** — `next/font/google` Archivo in `src/app/layout.tsx`, `--font-archivo` on `<html>`. |
| Full 11-step brand/warning/gray scales? | **No** — practical subset only (`jersey-red`, `gold`, `navy`, `surface`, `on-primary`, `success`, semantic aliases). |
| Dark mode? | **Not implemented** (`[data-theme="dark"]` absent). |
| Buttons / cards / badges | Public CTAs use `bg-jersey-red` + `text-on-primary`. AI blocks use gold border treatment. **Not** Untitled UI Button primitives. |

---

## 4. Database Schema

**Tables (Drizzle `src/db/schema.ts`):**

| Table | Columns (summary) | Constraints / indexes |
|-------|-------------------|------------------------|
| `candidates` | id uuid PK default `gen_random_uuid()`, name, slug, district, party, photo_url, bio, manifesto_raw/url, ai_summary, ai_issues jsonb, source_urls text[] default `{}`, data_hash, last_scraped_at, last_enriched_at, created_at, updated_at | Unique `slug`; index `district` |
| `articles` | id, title, source, url, published_at, content_raw/hash, candidate_mentions uuid[], ai_sentiment, ai_summary, created_at | Unique `url`; index `published_at` |
| `issues` | id, name, display_name, description, icon | Unique `name` |
| `candidate_issues` | candidate_id FK → candidates, issue_id FK → issues, position, source_quote, confidence, created_at | PK (candidate_id, issue_id); index issue_id |
| `snapshots` | id, entity_type, entity_id, data jsonb, captured_at | Index (entity_type, entity_id); index captured_at |

**Connection:** `src/db/index.ts` uses `postgres(DATABASE_URL, { prepare: false, max: … })` — suitable for **Supabase pooler**.

**RLS:** **Not defined** in this repository (must be added in Supabase SQL or noted as “server-only access” risk if anon keys ever hit DB).

**Migrations:** `drizzle/0000_enable_pgcrypto.sql` + `drizzle-kit` workflow; run `npm run db:migrate` / `db:push` per environment.

---

## 5. Authentication

| Item | Status |
|------|--------|
| Supabase Auth packages | **Added:** `@supabase/ssr`, `@supabase/supabase-js`. |
| `src/lib/supabase/server.ts` | **Yes** — `createSupabaseServerClient()` (returns `null` if env missing). |
| `src/lib/supabase/client.ts` | **Yes** — browser client for login. |
| `src/lib/supabase/middleware.ts` | **Yes** — session refresh + `/admin` gate. |
| `src/middleware.ts` | **Yes** — matcher `/admin`, `/admin/:path*`. |
| `/admin/login` | **Yes** — email/password form. |
| Protected admin shell | **Yes** — `src/app/admin/(protected)/layout.tsx` + dashboard placeholder. |
| Public routes | **No auth** required. |
| Service role usage | **Not wired** in app code (optional for future admin APIs). |

---

## 6. API Routes

| Method | Path | Purpose | Auth | Status |
|--------|------|---------|------|--------|
| GET | `/api/health` | DB + table probe, optional `logs/cron-state.json` | None | OK (`dynamic`, `nodejs`) |
| GET | `/api/compare` | Full candidate compare payload (`?ids=uuid,uuid` 2–4); includes `aiIssues`, bio, sources | None | OK |
| POST | `/api/revalidate` | ISR revalidate by secret + paths | `REVALIDATION_SECRET` body | OK |
| POST | `/api/auth/signout` | Clears Supabase session, redirects to login | Session cookie | OK |

---

## 7. Pages & UI

| Route | Data source | Rendering | Status |
|-------|-------------|-----------|--------|
| `/` | Drizzle counts (fallback if DB down at build) | Server, `revalidate = 60` | OK |
| `/candidates` | Drizzle list (fallback `[]`) | Server, ISR 6h | OK |
| `/candidates/[slug]` | Drizzle by slug; `generateStaticParams` (fallback `[]`) | Server, ISR 6h | Dynamic at runtime if not prebuilt |
| `/compare` | Drizzle + client fetch `/api/compare` | Hybrid | OK |
| `/trends` | Drizzle + raw SQL (fallback empty) | Server + client | OK |
| `/about` | Static | Server | OK |
| `/admin` | Supabase session | Server | OK (protected) |
| `/admin/login` | Supabase browser auth | Client form | OK |
| `/sitemap.xml` | `NEXT_PUBLIC_SITE_URL` only | Metadata route | OK |
| `/robots.txt` | Same | Metadata route | OK |

**Shared components (high level)**

- `NavMobile` — mobile drawer (`links` prop).
- `CandidateGrid`, `CompareClient`, `TrendsClient`, `ManifestoExpander` — feature-specific clients.
- `Crest` — inline in `layout.tsx` (SVG).

---

## 8. Scripts & Automation

| Script | Purpose | Run command | Status |
|--------|---------|-------------|--------|
| `cron.ts` | Schedules scrapers, enrich, news, ISR hooks | `npm run cron` | OK |
| `enrich.ts` | Candidate AI enrichment | `npm run enrich` | OK |
| `enrich-articles.ts` | Article enrichment | `npm run enrich:articles` | OK |
| `ingest-news.ts` | News ingest | `npm run ingest:news` | OK |
| `import-local-scrapes.ts` | Import scraped JSON into DB | `npm run import:local-scrapes` | OK |
| `seed-candidates.ts` | Seed candidates | `npm run seed` / `seed:candidates` | OK |
| `scrape-flow-je.ts` | flow.je | `npm run scrape:flow` | OK |
| `scrape-vote-je.ts` | vote.je | `npm run scrape:vote` | OK |
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
| `GROK_MODEL` | Grok model id | Optional (default `grok-2-latest` in scripts) | `scripts/enrich*.ts` |
| `FIRECRAWL_API_KEY` | Scraping | For scripts | Scrapers / cron |
| `FIRECRAWL_DAILY_CREDIT_LIMIT` | Credit guard | Optional | Scripts |
| `REVALIDATION_SECRET` | POST `/api/revalidate` | For webhook-style revalidation | `api/revalidate`, `cron.ts` |

---

## 10. Deployment Readiness

### Cloudflare Pages

- **Current Next config:** default Node server (`next build` / `next start`), **not** `output: 'export'`.
- **`wrangler.toml`:** Added stub pointing at `.vercel/output/static` for **`@cloudflare/next-on-pages`** workflow — you must align **build command** and **output dir** with the adapter version you choose.
- **Edge:** Database-bound routes expect **Node runtime** (`/api/*` sets `nodejs` where needed). Full edge parity is **not** verified.

### Railway

- **`railway.json`:** `startCommand`: `npx tsx scripts/cron.ts` — matches worker pattern.

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

### 🔵 Info (nice to have)

1. Add **`opengraph-image`** for richer social previews.
2. **`npm audit`** — address moderate/high findings when upgrading deps.
3. Consider **`pnpm`** lockfile consistency (README historically mentioned pnpm).

### 🎨 Design consistency (addressed in this pass)

- Replaced inline chart hex colours in **`trends-client.tsx`** with **`var(--chart-sentiment-*)`** (defined in `globals.css`).
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
- [ ] Database migrated on Supabase + **RLS** designed
- [x] `.env.example` expanded
- [x] `wrangler.toml` + `railway.json` stubs
- [x] No `localhost` in committed runtime config (only examples in docs / defaults)
- [x] ISR `revalidate` set on key routes
- [x] AI disclaimers on summaries / trends / home
- [x] Source URLs on candidate profiles (`sourceUrls`)
- [ ] Manual responsive QA
- [ ] OG images (dedicated asset/route)
- [x] `sitemap.xml` route
- [x] `robots.txt` route
- [x] `/api/health`
- [x] Focus styles on admin inputs (`ring-jersey-red`)

---

## Appendix — Commands verified (23 Apr 2026)

- `npx tsc --noEmit` — **pass**
- `npm run build` — **pass** with `DATABASE_URL` + `NEXT_PUBLIC_SITE_URL` set (DB may be unreachable thanks to fallbacks)
