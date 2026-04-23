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
| Frontend hosting | Cloudflare Pages (see `wrangler.toml` + `npm run pages:build`) or any Node host |
| Worker / cron | Railway (`railway.json` → `scripts/cron.ts`) |

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
| `pages:build` / `pages:dev` | Cloudflare adapter (see adapter docs) |

## Deployment

### Supabase (database)

1. Create a project at [https://supabase.com](https://supabase.com).
2. Use the **pooler** connection string (port `6543`, `pgbouncer=true`) for `DATABASE_URL` in serverless / Vercel / Cloudflare contexts.
3. Run `npm run db:push` (or your migration pipeline) against that database.
4. **RLS** — add policies if you ever expose the DB to untrusted clients (the app server uses the service connection string today).
5. Set **`ADMIN_SECRET`** on the web host if you use the `/admin` tool.

### Cloudflare Pages

1. Connect the Git repository.
2. Install and configure [`@cloudflare/next-on-pages`](https://github.com/cloudflare/next-on-pages) (or the current recommended adapter) — align `npm run pages:build` with Cloudflare’s docs for your Next.js version.
3. Set the same env vars as production (especially `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_SECRET` if using `/admin`).
4. Confirm **Node** compatibility for routes that talk to Postgres over TCP.

### Railway (cron worker)

1. Create a Railway service from this repo.
2. Set **Start Command** to `npx tsx scripts/cron.ts` (already reflected in `railway.json`).
3. Mirror **all** worker secrets: `DATABASE_URL`, `GROK_API_KEY` (or `XAI_API_KEY`), `FIRECRAWL_API_KEY`, `REVALIDATION_SECRET`, `NEXT_PUBLIC_SITE_URL`, etc.

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
Browser ──► Next.js (Pages/API on host of choice)
              │
              ├──► PostgreSQL (Supabase / Railway / local)
              │
              └──► Railway worker (cron.ts)
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
