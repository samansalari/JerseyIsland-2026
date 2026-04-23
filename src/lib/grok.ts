/**
 * xAI Grok — OpenAI-compatible Chat Completions API.
 *
 * VotePulse uses **Grok 4.1 Fast** only (`grok-4-1-fast-reasoning`). Grok 3
 * family ids in `GROK_MODEL` are ignored and remapped to that model.
 *
 * @see https://docs.x.ai/docs/guides/chat
 *
 * Auth: `Authorization: Bearer <key>`. Keys are read from `GROK_API_KEY`
 * or, for parity with xAI docs, `XAI_API_KEY`.
 */

const GROK_CHAT_URL = "https://api.x.ai/v1/chat/completions";

/** Grok 4.1 Fast — default when `GROK_MODEL` is unset (keep in sync with `scripts/enrich*.ts`). */
export const DEFAULT_GROK_MODEL = "grok-4-1-fast-reasoning";
const DEFAULT_MODEL = DEFAULT_GROK_MODEL;

/** Other retired exact ids (non–Grok-3) → Grok 4.1 Fast */
const LEGACY_MODEL_REMAP: Record<string, string> = {};

/** One warning per process — batch jobs call Grok many times. */
let legacyGrokModelWarned = false;

export interface GrokUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

export interface GrokChatOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Override `GROK_MODEL` / default */
  model?: string;
}

function apiKey(): string {
  const k = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!k?.trim()) {
    throw new Error(
      "GROK_API_KEY (or XAI_API_KEY) is not set — add it to .env.local",
    );
  }
  return k.trim();
}

/**
 * Model id actually sent to the API (applies `GROK_MODEL`, optional per-call
 * `override`, and legacy remaps). Use for logging from scripts.
 */
export function resolveGrokModelId(overrideFromCaller?: string): string {
  return modelId(overrideFromCaller);
}

function modelId(override?: string): string {
  const raw = (override || process.env.GROK_MODEL || DEFAULT_MODEL).trim();
  const m = raw || DEFAULT_MODEL;

  // Never use Grok 3 — project standard is Grok 4.1 Fast only
  if (m.startsWith("grok-3")) {
    if (!legacyGrokModelWarned) {
      legacyGrokModelWarned = true;
      console.warn(
        `[grok] Grok 3 is not used — switching to Grok 4.1 Fast (${DEFAULT_GROK_MODEL}). Set GROK_MODEL=${DEFAULT_GROK_MODEL} in .env.local.`,
      );
    }
    return DEFAULT_GROK_MODEL;
  }

  const remapped = LEGACY_MODEL_REMAP[m];
  if (remapped) {
    if (!legacyGrokModelWarned) {
      legacyGrokModelWarned = true;
      console.warn(
        `[grok] GROK_MODEL "${m}" is retired — using "${remapped}". Set GROK_MODEL=${remapped} in .env.local.`,
      );
    }
    return remapped;
  }
  return m;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip markdown fences and isolate a JSON object for parsing. */
export function extractJsonObject(text: string): string {
  let s = text.trim();
  if (s.startsWith("```json")) {
    s = s.replace(/^```json\s*/i, "").replace(/\s*```\s*$/i, "");
  } else if (s.startsWith("```")) {
    s = s.replace(/^```\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  s = s.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

/**
 * Single chat completion. Retries on 429 / 5xx with exponential backoff.
 */
export async function grokChatCompletion(
  options: GrokChatOptions,
): Promise<{ text: string; usage: GrokUsage; model: string }> {
  const model = modelId(options.model);
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (options.systemPrompt?.trim()) {
    messages.push({ role: "system", content: options.systemPrompt.trim() });
  }
  messages.push({ role: "user", content: options.userPrompt });

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0,
    max_tokens: options.maxTokens ?? 1024,
    stream: false,
  };

  const maxAttempts = 4;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(GROK_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey()}`,
        },
        body: JSON.stringify(body),
      });

      const rawText = await res.text();

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        const delayMs = 1000 * 2 ** attempt;
        console.warn(
          `  ⚠ Grok HTTP ${res.status} — retry in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxAttempts})`,
        );
        await sleep(delayMs);
        continue;
      }

      if (!res.ok) {
        throw new Error(`Grok API error ${res.status}: ${rawText.slice(0, 500)}`);
      }

      const data = JSON.parse(rawText) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          /** xAI / OpenAI-style optional breakdown */
          prompt_tokens_details?: { cached_tokens?: number };
          /** Some providers use this name */
          cache_read_input_tokens?: number;
        };
      };

      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text) {
        throw new Error("Grok returned empty message content");
      }

      const u = data.usage;
      const cachedFromDetails = u?.prompt_tokens_details?.cached_tokens ?? 0;
      const cachedFromTop = u?.cache_read_input_tokens ?? 0;
      const cachedTokens = cachedFromDetails || cachedFromTop;

      const usage: GrokUsage = {
        promptTokens: u?.prompt_tokens ?? 0,
        completionTokens: u?.completion_tokens ?? 0,
        cachedTokens,
      };

      return { text, usage, model };
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts - 1) {
        const delayMs = 1000 * 2 ** attempt;
        console.warn(
          `  ⚠ Grok request failed — retry in ${delayMs / 1000}s: ${e instanceof Error ? e.message : e}`,
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "Grok request failed"));
}

/**
 * Result of JSON-mode completion: parsed payload + usage (for cost tracking).
 */
export interface GrokJsonResult<T> {
  data: T;
  usage: GrokUsage;
  model: string;
}

/**
 * Chat completion → parse JSON (with fence / substring fallbacks).
 * Callers (enrich scripts) should record `usage` via `tokenTracker`.
 */
export async function grokChatCompletionJson<T>(
  options: GrokChatOptions,
): Promise<GrokJsonResult<T>> {
  const { text, usage, model } = await grokChatCompletion(options);

  const jsonStr = extractJsonObject(text);
  try {
    const data = JSON.parse(jsonStr) as T;
    return { data, usage, model };
  } catch {
    throw new Error(
      `Invalid JSON from Grok (first 240 chars): ${jsonStr.slice(0, 240)}`,
    );
  }
}
