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
| **Candidate Profiles** | District, party, original manifesto (raw markdown), AI summary & issue stances. Social links extracted from `social_links` JSONB via `buildSocialLinks()`. Historical flow.je data shown with an amber notice when no 2026 manifesto exists. |
| **Side-by-Side Compare** (`/compare`) | Deep comparison table for 2–4 candidates: photo, AI summary, party, district, and 10 canonical issue rows (housing → public services) with position, confidence badge, and expandable source quote. |
| **Public Pulse** (`/trends`) | Live issue poll (one vote / 24h per fingerprint), community star ratings, real-time leaderboard, and AI-generated insight text refreshed every 6 hours via a Railway worker cron. |
| **Data Pipeline** | flow.je JSON → `import:local` → `scrape:vote` → `scrape:manifestos` → `extract:social`. AI enrichment via xAI Grok. |
| **Admin Panel** (`/admin`) | Password-gated internal tool for scrapers, batch enrichment, clearing poll data, and regenerating AI insights. |
| **Rate Limiting** | ioredis-backed rate limits on Pulse vote/rate routes; fails open when `REDIS_URL` is unset. |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 15** — App Router, TypeScript, ISR |
| Styling | **Tailwind CSS 3** — Jersey palette (`jersey-red`, `gold`, `navy`) |
| Fonts | **Archivo** via `next/font/google` |
| Database | **PostgreSQL** via Drizzle ORM (`postgres` driver, `prepare: false` for Supabase pooler) |
| AI | **xAI Grok** — manifesto summaries, issue stances, article sentiment |
| Scraping | **Firecrawl** (`@mendable/firecrawl-js`) |
| Hosting | **Railway** — Web (Next.js) + Worker (`scripts/cron.ts`) |
| Rate limits | **ioredis** + `REDIS_URL` |
| Cron | Railway worker — 6h Pulse insight · 2h news · daily scrape · 27 Apr 08:00 official-list chain |

---

## Architecture

```
Browser ──► Next.js on Railway (Web)
              │
              ├──► PostgreSQL (Supabase pooler, port 6543)
              │
              └──► Railway Worker (cron.ts)
                      ├── Firecrawl / RSS scrapers
                      ├── xAI Grok enrichment
                      └── POST /api/revalidate (ISR)
```

---

## Getting started

### Prerequisites

- Node.js **20+**
- PostgreSQL (local Docker, Railway, or Supabase)
- `ADMIN_SECRET` for `/admin`
- `REDIS_URL` for production rate limiting (optional locally)
- xAI Grok API key (`GROK_API_KEY`) + Firecrawl API key for scrapers

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
| `scrape:manifestos` | 2026 manifesto URLs from vote.je |
| `extract:social` | `manifesto_raw` → `social_links` |
| `validate:social` | Report resolvable social URLs |
| `enrich` / `enrich:batch` | xAI Grok enrichment |
| `ingest:news` | RSS / news ingest |
| `cron` | Railway worker — full job orchestrator |

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
| `GROK_API_KEY` / `XAI_API_KEY` | optional | ✅ | xAI Grok |
| `GROK_MODEL` | optional | optional | Default: `grok-4-1-fast-reasoning` |
| `FIRECRAWL_API_KEY` | — | ✅ | Scrapers |
| `NEXT_PUBLIC_SITE_URL` | ✅ | ✅ | Public URL (ISR revalidation) |
| `REVALIDATION_SECRET` | ✅ | ✅ | `POST /api/revalidate` |
| `REDIS_URL` | recommended | recommended | ioredis rate limiting |
| `ADMIN_SECRET` | ✅ | — | Cookie-gated admin panel |
| `NODE_ENV` | `production` | `production` | |

### First-deploy checklist

- [ ] Supabase project created; `npm run db:migrate` applied
- [ ] `npm run db:seed` for issues taxonomy
- [ ] `npm run import:local` (flow.je JSON) + `npm run extract:social`
- [ ] `GET /api/health` returns `{ database: "connected" }`
- [ ] Worker logs show `CRON: VotePulse orchestrator starting`
- [ ] `/admin/login` works with `ADMIN_SECRET`

---

## Public Pulse — how it works

- **Voting:** `POST /api/pulse/vote` — Zod-validated issue key, one vote per fingerprint per 24h via `vp_voted` cookie + server fingerprint. Redis-backed rate limit.
- **Ratings:** `POST /api/pulse/rate` — one rating per candidate per 24h.
- **Results:** `GET /api/pulse/results` — aggregates + leaderboard (candidates with ≥ 3 ratings).
- **AI Insight:** `GET /api/pulse/insight` — **DB read only**. Rows written by `generatePulseInsight()` every 6 hours (cron) or via `POST /api/admin/regenerate-insight`. Never calls Grok on request.
- **DB tables:** `issue_votes`, `candidate_ratings`, `pulse_insights` (see `src/db/schema.ts`).

---

## For auditors & reviewers

- **Compare data source:** `/compare` reads `candidates.ai_issues` (JSONB). The `candidate_issues` junction table may be empty in some deployments.
- **Social links:** `buildSocialLinks()` only emits URLs that pass `new URL()`. Re-run `validate:social` after bulk imports.
- **AI layer:** enrichment is **xAI Grok** only (`src/lib/grok.ts`). Anthropic / OpenAI are not used.
- **Rate limiting:** Redis-backed via ioredis. Routes fail open when `REDIS_URL` is unset.
- **Official list cron:** one-time job at `08:00 Europe/London on 27 April` — runs full scrape → import → enrich → revalidate chain. Adjust annually.
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
