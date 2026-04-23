# VotePulse

Public, non-partisan election intelligence for Jersey’s 2026 general election: candidates, AI-assisted manifesto summaries (with disclaimers), issue comparisons, and media sentiment views. Sources are preserved and linked wherever possible.

> **Screenshots:** add hero / candidates / compare captures under `public/` when you have production captures.

## Tech stack

| Layer | Choice |
|-------|--------|
| Web | Next.js 15 (App Router, TypeScript, ISR) |
| Styling | Tailwind CSS 3, Jersey palette (`tailwind.config.ts` + `globals.css`) |
| Fonts | Archivo (Google Fonts via `next/font`) |
| Database | PostgreSQL via Drizzle ORM (`postgres` driver, `prepare: false` for Supabase pooler) |
| Admin | Cookie gate via `ADMIN_SECRET` (internal `/admin` tool) |
| AI | xAI Grok (`fetch` → `https://api.x.ai/v1/chat/completions`) |
| Scraping | Firecrawl (`@mendable/firecrawl-js`) |
| Production hosting | **Railway** — Web (Next.js) + Worker (`scripts/cron.ts`); see [Deployment](#deployment) |
| Optional | Cloudflare Pages (`wrangler.toml` + `pages:build`) is not required for Railway |
| Worker / cron | Railway worker service (`railway.worker.json` → `npx tsx scripts/cron.ts`) |

A detailed audit lives in [`docs/CODEBASE-REPORT.md`](docs/CODEBASE-REPORT.md).

## Prerequisites

- Node.js **20+**
- A **PostgreSQL** database (local Docker, Railway, or **Supabase**)
- **`ADMIN_SECRET`** in `.env.local` if you use `/admin`
- **xAI Grok** (`GROK_API_KEY` or `XAI_API_KEY`) and **Firecrawl** API keys for enrichment / scrapers

## Local development

1. **Clone** the repository and install dependencies:

   ```bash
   npm install
   ```

   The repo ships with `.npmrc` (`legacy-peer-deps=true`) because Next 15’s React RC and Drizzle’s peer metadata disagree on npm’s strict resolver.

2. **Environment** — copy the example file and fill in values:

   ```bash
   cp .env.example .env.local
   ```

   At minimum set `DATABASE_URL` and `NEXT_PUBLIC_SITE_URL`. For `/admin`, set `ADMIN_SECRET`.

3. **Database** — from the project root:

   ```bash
   npm run db:push
   ```

   Or run migrations (`npm run db:migrate`) if you maintain generated SQL.

4. **Seed issues** (taxonomy) and optionally candidates:

   ```bash
   npm run db:seed
   npm run seed
   ```

5. **Dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). A JSON health probe lives at [`/api/health`](http://localhost:3000/api/health).

## npm scripts

| Script | Description |
|--------|-------------|
| `dev` / `build` / `start` | Standard Next.js |
| `typecheck` | `tsc --noEmit` |
| `lint` | `next lint` |
| `db:generate` / `db:push` / `db:migrate` / `db:studio` | Drizzle |
| `db:seed` | Issues seed (`src/db/seed.ts`) |
| `seed` / `seed:candidates` | `scripts/seed-candidates.ts` |
| `enrich` / `enrich:articles` | AI pipelines |
| `scrape:flow` / `scrape:vote` | Site scrapers |
| `ingest:news` | RSS / news ingest |
| `cron` | Long-running Railway worker |
| `pages:build` / `pages:dev` | Optional Cloudflare adapter (not used on Railway) |

## Deployment

VotePulse is configured to run on **Railway** as **two services** from the same GitHub repository (no Cloudflare or Vercel required).

### Prerequisites

- [Railway](https://railway.app) account
- [Supabase](https://supabase.com) project (Postgres)
- [xAI](https://console.x.ai) Grok API key
- [Firecrawl](https://firecrawl.dev) API key
- This repository connected to Railway

**Repo config files:** `railway.json` (Web), `railway.worker.json` (Worker), `nixpacks.toml` (Node 20 + build). In Railway, the **Worker** service should point at `railway.worker.json` (or set **Build** to `npm install` and **Start** to `npx tsx scripts/cron.ts` manually) so it does not run a full `npm run build` unless you want to.

### Service 1 — Web (Next.js)

1. **New Project** → **Deploy from GitHub** → select this repo.
2. **Settings → Config as code:** `railway.json` (or let Railway detect Next.js and set **Build** `npm run build`, **Start** `npm start`).
3. **Port:** leave default (Next listens on `PORT`; Railway sets it — `npm run start` uses it).
4. **Healthcheck:** `GET /api/health` (30s timeout) — set in `railway.json` when that file is used.
5. **Environment variables:** copy from `.env.example` — at minimum `DATABASE_URL`, `NEXT_PUBLIC_*` Supabase keys, `NEXT_PUBLIC_SITE_URL` (your `*.railway.app` or custom domain), `REVALIDATION_SECRET`, `ADMIN_SECRET` if you use `/admin`, `RESEND_API_KEY` if you use email. Add **`DATABASE_URL` before the first `npm run build`** on Railway if you want every `/candidates/[slug]` page **pre-generated** at build time; the build can still succeed without it (routes stay on-demand until you set it and rebuild).
6. `SKIP_DB_HEALTHCHECK` should be `false` (or unset) in production so `/api/health` validates Postgres.

### Service 2 — Worker (cron / scrapers / enrichment)

1. In the **same** Railway project → **New** → **GitHub repo** (this repo again).
2. **Build:** `npm install` only (see `railway.worker.json`). **Start:** `npx tsx scripts/cron.ts` (or `npm run cron`).
3. **Environment:** mirror **server** secrets: `DATABASE_URL`, `GROK_API_KEY`, `GROK_MODEL`, `FIRECRAWL_API_KEY`, `FIRECRAWL_DAILY_CREDIT_LIMIT`, `REVALIDATION_SECRET`, `NEXT_PUBLIC_SITE_URL` (needed for revalidation fetches), `RESEND` if used. `NEXT_PUBLIC_*` vars are only required on the Web service for the UI; the worker can omit them if your worker code does not read them (this project’s `cron.ts` uses `NEXT_PUBLIC_SITE_URL` for revalidation).
4. No separate build artifact — long-running `node-cron` process.

### Environment variables (summary)

| Variable | Web | Worker | Notes |
|----------|-----|--------|--------|
| `DATABASE_URL` | Yes | Yes | Supabase **pooler** (port 6543, `pgbouncer=true`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Optional | — |
| `NEXT_PUBLIC_SUPABASE_*` (anon/publishable) | Yes | Optional | — |
| `GROK_API_KEY` / `XAI_API_KEY` | If enriching from web | Yes for cron enrich | — |
| `GROK_MODEL` | Optional | Optional | Default in code: `grok-4-1-fast-reasoning` |
| `FIRECRAWL_API_KEY` | Optional | Yes for scrapers | — |
| `NEXT_PUBLIC_SITE_URL` | Yes | Yes (revalidate) | Public site URL |
| `REVALIDATION_SECRET` | Yes | Yes | ISR `POST /api/revalidate` |
| `ADMIN_SECRET` | If using `/admin` | No | — |
| `NODE_ENV` | `production` | `production` | — |
| `SKIP_DB_HEALTHCHECK` | `false` | — | Web healthcheck must hit DB in prod |

### First deploy checklist

- [ ] Supabase project created; `npm run db:push` (or `db:migrate`) applied with `DATABASE_URL` / `DIRECT_URL` from `.env`
- [ ] `npm run db:seed` for issues taxonomy
- [ ] Candidates: `npm run import:local` (or your seeding path) before expecting full UI
- [ ] Web service: deploy succeeds; `GET /api/health` returns `200` with `database: "connected"`
- [ ] Worker service: logs show `CRON: VotePulse orchestrator starting`
- [ ] `/admin/login` works if you set admin auth env vars

### Supabase (database)

1. Create a project at [https://supabase.com](https://supabase.com).
2. Use the **pooler** connection string (port `6543`, `pgbouncer=true`) for `DATABASE_URL` in Railway and local server contexts.
3. **RLS** — see `drizzle/*` and Supabase policies if you expose the DB beyond the app server.
4. Set **`ADMIN_SECRET`** on the web host if you use `/admin`.

### Cloudflare Pages (optional)

1. See `wrangler.toml` and `npm run pages:build` if you use the Cloudflare adapter; otherwise prefer Railway for the main app.

## Operations

### Add or edit candidates

- Use `scripts/seed-candidates.ts` / `data/candidates.json` as a starting point, or insert directly with Drizzle Studio (`npm run db:studio`).
- Keep `source_urls` accurate; raw manifesto fields are treated as immutable by the enricher.

### Run AI enrichment

VotePulse uses **xAI Grok** (Chat Completions API) to summarise manifestos, extract issue stances, and classify article sentiment. Set `GROK_API_KEY` (or `XAI_API_KEY`) and optional `GROK_MODEL` in `.env.local` (see [xAI API docs](https://docs.x.ai/docs/guides/chat)).

```bash
npm run enrich
npm run enrich:articles
```

### Update scrapers

- Implement or extend files under `scripts/scrapers/`, then wire them in `scripts/cron.ts`.
- A **policy.je** scraper is still outstanding — see `docs/CODEBASE-REPORT.md`.

## Architecture (text)

```
Browser ──► Next.js on Railway (Web service)
              │
              ├──► PostgreSQL (Supabase pooler)
              │
              └──► Railway Worker (cron.ts)
                      ├── Firecrawl / RSS / scrapers
                      ├── Grok enrichment
                      └── POST /api/revalidate (ISR)
```

## Design tokens

Canonical colours live in `tailwind.config.ts` (`jersey-red`, `gold`, `navy`, `surface`, `on-primary`, `success`) and in `globals.css` CSS variables. Prefer Tailwind utilities (`bg-jersey-red`, `text-on-primary`) over ad-hoc hex in components.

## Contributing

Issues and PRs are welcome. Keep changes focused; match existing formatting and patterns.

## Licence

MIT
