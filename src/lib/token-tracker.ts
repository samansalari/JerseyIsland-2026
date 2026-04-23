// Tracks Grok API token usage across a session.
// Estimates cost at xAI Grok 4.1 Fast rates (2026 / project default).

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const PRICING = {
  input: 0.2 / 1_000_000, // $0.20 per 1M input tokens
  output: 0.5 / 1_000_000, // $0.50 per 1M output tokens
  cached: 0.05 / 1_000_000, // $0.05 per 1M cached tokens
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface CallRecord {
  timestamp: Date;
  label: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
}

class TokenTracker {
  private calls: CallRecord[] = [];

  record(
    label: string,
    input: number,
    output: number,
    cached = 0,
  ): CallRecord {
    const costUsd =
      input * PRICING.input + output * PRICING.output + cached * PRICING.cached;

    const rec: CallRecord = {
      timestamp: new Date(),
      label,
      inputTokens: input,
      outputTokens: output,
      cachedTokens: cached,
      costUsd,
    };
    this.calls.push(rec);
    return rec;
  }

  get totals(): TokenUsage {
    const inputTokens = this.calls.reduce((s, c) => s + c.inputTokens, 0);
    const outputTokens = this.calls.reduce((s, c) => s + c.outputTokens, 0);
    const cachedTokens = this.calls.reduce((s, c) => s + c.cachedTokens, 0);
    const costUsd = this.calls.reduce((s, c) => s + c.costUsd, 0);
    return {
      inputTokens,
      outputTokens,
      cachedTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd,
    };
  }

  get callCount(): number {
    return this.calls.length;
  }

  printSummary(): void {
    const t = this.totals;
    console.log("\n=== TOKEN USAGE SUMMARY ===");
    console.log(`  Calls         : ${this.callCount}`);
    console.log(`  Input tokens  : ${t.inputTokens.toLocaleString()}`);
    console.log(`  Output tokens : ${t.outputTokens.toLocaleString()}`);
    console.log(`  Cached tokens : ${t.cachedTokens.toLocaleString()}`);
    console.log(`  Total tokens  : ${t.totalTokens.toLocaleString()}`);
    console.log(`  Cost (est.)   : $${t.costUsd.toFixed(4)} USD`);
    console.log("============================\n");
  }

  printCall(record: CallRecord): void {
    console.log(
      `  [tokens] in:${record.inputTokens} out:${record.outputTokens}` +
        (record.cachedTokens ? ` cached:${record.cachedTokens}` : "") +
        ` | $${record.costUsd.toFixed(5)}`,
    );
  }

  reset(): void {
    this.calls = [];
  }
}

export const tokenTracker = new TokenTracker();

/** Append one JSON line to logs/token-usage.jsonl and clear the in-memory session. */
export function logTokenUsageToJsonl(runType: string): void {
  if (tokenTracker.callCount === 0) return;
  const dir = join(process.cwd(), "logs");
  mkdirSync(dir, { recursive: true });
  const t = tokenTracker.totals;
  const entry = {
    timestamp: new Date().toISOString(),
    runType,
    ...t,
    calls: tokenTracker.callCount,
  };
  appendFileSync(
    join(dir, "token-usage.jsonl"),
    JSON.stringify(entry) + "\n",
    "utf8",
  );
  tokenTracker.reset();
}
