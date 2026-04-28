import cron from "node-cron";
import { execFile, execSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * VotePulse — Cron Orchestrator
 *
 * Long-running process that schedules scrapers, enrichment, and ISR
 * revalidation. Deploy as a separate worker (Railway, PM2, systemd).
 *
 * Usage:
 *   npx tsx scripts/cron.ts
 *   pnpm cron
 *
 * Requires all env vars from .env.local:
 *   DATABASE_URL, GROK_API_KEY (or XAI_API_KEY), FIRECRAWL_API_KEY,
 *   REVALIDATION_SECRET, NEXT_PUBLIC_SITE_URL
 */

// ── Bootstrap ───────────────────────────────────────────────────────────────

const { config } = await import("dotenv");
config({ path: ".env.local" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET ?? "";
const LOGS_DIR = join(process.cwd(), "logs");

mkdirSync(LOGS_DIR, { recursive: true });

// ── State tracking ──────────────────────────────────────────────────────────

type TaskResultKind = "success" | "fail";

interface RunState {
  lastScrape: {
    flow_je: string | null;
    vote_je: string | null;
    policy_je: string | null;
  };
  lastScrapeResult: {
    flow_je: TaskResultKind | null;
    vote_je: TaskResultKind | null;
    policy_je: TaskResultKind | null;
  };
  lastEnrichment: string | null;
  lastEnrichmentResult: TaskResultKind | null;
  lastNewsIngest: string | null;
  lastNewsIngestResult: TaskResultKind | null;
  lastEnrichArticlesResult: TaskResultKind | null;
  lastArticleEnrichment: string | null;
  firecrawlCreditsToday: number;
  warningsLast24h: number;
  creditResetDate: string;
}

const STATE_FILE = join(LOGS_DIR, "cron-state.json");

function loadState(): RunState {
  const defaults: RunState = {
    lastScrape: { flow_je: null, vote_je: null, policy_je: null },
    lastScrapeResult: { flow_je: null, vote_je: null, policy_je: null },
    lastEnrichment: null,
    lastEnrichmentResult: null,
    lastNewsIngest: null,
    lastNewsIngestResult: null,
    lastEnrichArticlesResult: null,
    lastArticleEnrichment: null,
    firecrawlCreditsToday: 0,
    warningsLast24h: 0,
    creditResetDate: new Date().toISOString().slice(0, 10),
  };
  if (existsSync(STATE_FILE)) {
    try {
      const p = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<RunState>;
      return {
        ...defaults,
        ...p,
        lastScrape: { ...defaults.lastScrape, ...p.lastScrape },
        lastScrapeResult: {
          ...defaults.lastScrapeResult,
          ...p.lastScrapeResult,
        },
        lastEnrichmentResult: p.lastEnrichmentResult ?? defaults.lastEnrichmentResult,
        lastNewsIngestResult: p.lastNewsIngestResult ?? defaults.lastNewsIngestResult,
        lastEnrichArticlesResult:
          p.lastEnrichArticlesResult ?? defaults.lastEnrichArticlesResult,
        lastArticleEnrichment:
          p.lastArticleEnrichment ?? defaults.lastArticleEnrichment,
      };
    } catch {
      return defaults;
    }
  }
  return defaults;
}

function saveState(state: RunState) {
  const today = new Date().toISOString().slice(0, 10);
  if (state.creditResetDate !== today) {
    state.firecrawlCreditsToday = 0;
    state.creditResetDate = today;
  }
  const { writeFileSync } = require("node:fs");
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

let state = loadState();

// ── Logging ─────────────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(msg: string) {
  console.log(`[${ts()}] ${msg}`);
}

function warn(source: string, msg: string) {
  const line = `[${ts()}] ${source}: ${msg}`;
  console.warn(line);
  appendFileSync(join(LOGS_DIR, "warnings.log"), line + "\n");
  state.warningsLast24h++;
}

// ── Task runner ─────────────────────────────────────────────────────────────

interface TaskResult {
  ok: boolean;
  duration: number;
  output: string;
}

function runScript(scriptPath: string, args: string[] = []): Promise<TaskResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = execFile(
      "npx",
      ["tsx", scriptPath, ...args],
      {
        cwd: process.cwd(),
        env: process.env as NodeJS.ProcessEnv,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 600_000, // 10 min max per script
      },
      (error, stdout, stderr) => {
        const duration = (Date.now() - start) / 1000;
        const output = (stdout + "\n" + stderr).trim();
        if (error) {
          resolve({ ok: false, duration, output });
        } else {
          resolve({ ok: true, duration, output });
        }
      },
    );
  });
}

async function runTask(
  label: string,
  scriptPath: string,
  args: string[] = [],
): Promise<boolean> {
  log(`${label}: started`);
  const result = await runScript(scriptPath, args);
  const status = result.ok ? "complete" : "FAILED";
  log(`${label}: ${status} (${result.duration.toFixed(0)}s)`);

  if (!result.ok) {
    warn(label, `Script failed — see output below`);
    // Log last 20 lines of output to warnings
    const lines = result.output.split("\n").slice(-20);
    for (const line of lines) {
      if (line.trim()) appendFileSync(join(LOGS_DIR, "warnings.log"), `  ${line}\n`);
    }
  }

  // Print output (truncated in console)
  if (result.output) {
    const lines = result.output.split("\n");
    for (const line of lines.slice(-15)) {
      if (line.trim()) console.log(`  ${line}`);
    }
  }

  return result.ok;
}

// ── Revalidation ────────────────────────────────────────────────────────────

async function triggerRevalidation() {
  if (!REVALIDATION_SECRET) {
    log("REVALIDATE: skipped (REVALIDATION_SECRET not set)");
    return;
  }

  const paths = ["/", "/candidates", "/compare"];
  log(`REVALIDATE: triggering for ${paths.join(", ")}`);

  try {
    const res = await fetch(`${SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: REVALIDATION_SECRET, paths }),
    });
    const data = await res.json();
    log(`REVALIDATE: ${res.ok ? "success" : "failed"} — ${JSON.stringify(data)}`);
  } catch (err) {
    warn("REVALIDATE", `Fetch failed: ${err instanceof Error ? err.message : err}`);
  }
}

// ── Cycles ──────────────────────────────────────────────────────────────────

async function sixHourCycle() {
  const cycleStart = Date.now();
  log("CRON: Starting 6-hour cycle");

  // 1. Scrapers
  const nowFlow = new Date().toISOString();
  if (await runTask("SCRAPE flow.je", "scripts/scrapers/scrape-flow-je.ts")) {
    state.lastScrape.flow_je = nowFlow;
    state.lastScrapeResult.flow_je = "success";
  } else {
    state.lastScrape.flow_je = nowFlow;
    state.lastScrapeResult.flow_je = "fail";
  }

  const nowVote = new Date().toISOString();
  if (await runTask("SCRAPE vote.je", "scripts/scrapers/scrape-vote-je.ts")) {
    state.lastScrape.vote_je = nowVote;
    state.lastScrapeResult.vote_je = "success";
  } else {
    state.lastScrape.vote_je = nowVote;
    state.lastScrapeResult.vote_je = "fail";
  }

  // policy.je scraper — uncomment when built
  // if (await runTask("SCRAPE policy.je", "scripts/scrapers/scrape-policy-je.ts")) {
  //   state.lastScrape.policy_je = new Date().toISOString();
  // }

  // 2. Candidate enrichment (for any that changed)
  // Token usage and cost: child processes append to logs/token-usage.jsonl
  // and print a summary on exit (see src/lib/token-tracker.ts), not in this process.
  const nowEnr = new Date().toISOString();
  if (await runTask("ENRICH candidates", "scripts/enrich.ts")) {
    state.lastEnrichment = nowEnr;
    state.lastEnrichmentResult = "success";
  } else {
    state.lastEnrichment = nowEnr;
    state.lastEnrichmentResult = "fail";
  }

  // 3. Public Pulse summary (Grok → DB only; /api/pulse/insight reads cache)
  await runTask("PULSE insight", "scripts/generate-pulse-insight.ts");

  // 4. ISR revalidation
  await triggerRevalidation();

  saveState(state);

  const total = ((Date.now() - cycleStart) / 1000).toFixed(0);
  log(`CRON: 6-hour cycle complete (total: ${total}s)\n`);
}

async function twoHourCycle() {
  const cycleStart = Date.now();
  log("CRON: Starting 2-hour news cycle");

  // 1. News ingestion
  const nowNews = new Date().toISOString();
  if (await runTask("INGEST news", "scripts/ingest-news.ts")) {
    state.lastNewsIngest = nowNews;
    state.lastNewsIngestResult = "success";
  } else {
    state.lastNewsIngest = nowNews;
    state.lastNewsIngestResult = "fail";
  }

  // 2. Article enrichment
  const nowArtEnr = new Date().toISOString();
  if (await runTask("ENRICH articles", "scripts/enrich-articles.ts")) {
    state.lastEnrichArticlesResult = "success";
    state.lastArticleEnrichment = nowArtEnr;
  } else {
    state.lastEnrichArticlesResult = "fail";
    state.lastArticleEnrichment = nowArtEnr;
  }

  // 3. ISR revalidation
  await triggerRevalidation();

  saveState(state);

  const total = ((Date.now() - cycleStart) / 1000).toFixed(0);
  log(`CRON: 2-hour news cycle complete (total: ${total}s)\n`);
}

async function dailyCycle() {
  log("CRON: Starting daily maintenance (3am UTC)");

  // Re-enrich stale candidates (>7 days)
  await runTask("ENRICH stale candidates", "scripts/enrich.ts");

  // Credit summary
  log(`CRON: Firecrawl credits used today: ${state.firecrawlCreditsToday}`);
  log(`CRON: Warnings in last 24h: ${state.warningsLast24h}`);

  // Reset 24h warning counter
  state.warningsLast24h = 0;
  saveState(state);

  log("CRON: Daily maintenance complete\n");
}

async function socialScrapeCycle() {
  log("CRON: Starting daily social scrape (06:00 Europe/London)");
  const cycleStart = Date.now();

  // 1. Discover any new social links embedded in manifesto text
  await runTask("DISCOVER social links", "scripts/discover-social-links.ts");

  // 2. Scrape all candidates that have scrapeable social URLs
  await runTask("SCRAPE social pages", "scripts/scrape-social.ts");

  // 3. Revalidate affected pages
  await triggerRevalidation();

  const total = ((Date.now() - cycleStart) / 1000).toFixed(0);
  log(`CRON: Social scrape cycle complete (${total}s)\n`);
}

async function supervisorCycle() {
  // Kimi K2.6 reads manifestos + Grok summaries and scores them. Default
  // mode of the script only re-reviews summaries that have been re-enriched
  // since their last review, so this is cheap (~$0.05/day at steady state).
  log("CRON: Starting Kimi K2.6 supervisor pass (02:00 Europe/London)");
  const cycleStart = Date.now();
  await runTask("REVIEW summaries (Kimi K2.6)", "scripts/review-summaries.ts");
  await triggerRevalidation();
  const total = ((Date.now() - cycleStart) / 1000).toFixed(0);
  log(`CRON: Supervisor cycle complete (${total}s)\n`);
}

// ── Schedule ────────────────────────────────────────────────────────────────

log("CRON: VotePulse orchestrator starting");
log(`CRON: Site URL: ${SITE_URL}`);
log(`CRON: Revalidation secret: ${REVALIDATION_SECRET ? "set" : "NOT SET"}`);
log("");
console.log("[cron] Schedule:");
console.log("  02:00 — Kimi K2.6 supervision");
console.log("  06:00 — Social scrape cycle");
console.log(
  "  08:00 — Daily content update (scrape → enrich → supervise → topics)",
);
console.log("  Every 2h — News ingest");
console.log("  Every 6h — Pulse insight regeneration");
console.log("");

// Every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC
cron.schedule("0 0,6,12,18 * * *", () => {
  sixHourCycle().catch((err) =>
    warn("CRON", `6-hour cycle crashed: ${err instanceof Error ? err.message : err}`),
  );
});

// Every 2 hours (offset by 30 min so it doesn't collide with the 6h cycle)
cron.schedule("30 1,3,5,7,9,11,13,15,17,19,21,23 * * *", () => {
  twoHourCycle().catch((err) =>
    warn("CRON", `2-hour cycle crashed: ${err instanceof Error ? err.message : err}`),
  );
});

// Daily at 3am UTC
cron.schedule("0 3 * * *", () => {
  dailyCycle().catch((err) =>
    warn("CRON", `Daily cycle crashed: ${err instanceof Error ? err.message : err}`),
  );
});

// Daily at 06:00 Europe/London — scrape social media for policy updates
cron.schedule(
  "0 6 * * *",
  () => {
    socialScrapeCycle().catch((err) =>
      warn(
        "CRON",
        `Social scrape cycle crashed: ${err instanceof Error ? err.message : err}`,
      ),
    );
  },
  { timezone: "Europe/London" },
);

// Daily at 02:00 Europe/London — Kimi K2.6 reviews any summaries Grok has
// updated since the last review pass.
cron.schedule(
  "0 2 * * *",
  () => {
    supervisorCycle().catch((err) =>
      warn(
        "CRON",
        `Supervisor cycle crashed: ${err instanceof Error ? err.message : err}`,
      ),
    );
  },
  { timezone: "Europe/London" },
);

// Daily at 08:00 Europe/London — manifesto scrape, selective enrich, Kimi, topics, ISR
cron.schedule(
  "0 8 * * *",
  () => {
    log("[cron] Daily update cycle starting...");
    const start = Date.now();
    try {
      execSync("npx tsx scripts/daily-update-cycle.ts", {
        stdio: "inherit",
        timeout: 900_000,
        cwd: process.cwd(),
        env: process.env as NodeJS.ProcessEnv,
      });
      log(
        `[cron] Daily update done in ${((Date.now() - start) / 1000 / 60).toFixed(1)}min`,
      );
    } catch (err) {
      console.error("[cron] Daily update failed:", err);
    }
  },
  { timezone: "Europe/London" },
);

// Run 6-hour cycle immediately on start
log("CRON: Running initial 6-hour cycle…\n");
sixHourCycle().catch((err) =>
  warn("CRON", `Initial cycle crashed: ${err instanceof Error ? err.message : err}`),
);

// Keep process alive. Do not call `process.exit(0)` at the end of this file — that
// would tear down the event loop and stop all scheduled crons. Clean shutdown uses
// the handlers below (exit code 0 on SIGINT / SIGTERM).
log("CRON: Scheduler active. Ctrl+C to stop.\n");

function shutdown(signal: string) {
  log(`CRON: Received ${signal}, stopping`);
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
