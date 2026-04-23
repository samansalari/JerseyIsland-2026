import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ExecOutcome = { ok: boolean; durationSec: number; output: string };

/**
 * Run a repo script via `npx tsx` (same pattern as `scripts/cron.ts`).
 */
export async function runRepoScript(
  scriptPath: string,
  args: string[] = [],
  timeoutMs = 600_000,
): Promise<ExecOutcome> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execFileAsync(
      "npx",
      ["tsx", scriptPath, ...args],
      {
        cwd: process.cwd(),
        env: process.env as NodeJS.ProcessEnv,
        maxBuffer: 10 * 1024 * 1024,
        timeout: timeoutMs,
      },
    );
    const durationSec = (Date.now() - start) / 1000;
    return {
      ok: true,
      durationSec,
      output: `${stdout}\n${stderr}`.trim(),
    };
  } catch (err) {
    const durationSec = (Date.now() - start) / 1000;
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n");
    return { ok: false, durationSec, output: output || String(err) };
  }
}
