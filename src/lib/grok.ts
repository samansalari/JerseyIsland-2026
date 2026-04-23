/**
 * xAI Grok — OpenAI-compatible Chat Completions API.
 *
 * @see https://docs.x.ai/docs/guides/chat
 * @see https://docs.x.ai/developers/model-capabilities/legacy/chat-completions
 *
 * Auth: `Authorization: Bearer <key>`. Keys are read from `GROK_API_KEY`
 * or, for parity with xAI docs, `XAI_API_KEY`.
 */

const GROK_CHAT_URL = "https://api.x.ai/v1/chat/completions";

const DEFAULT_MODEL = "grok-2-latest";

export interface GrokUsage {
  promptTokens: number;
  completionTokens: number;
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

function modelId(override?: string): string {
  const m = (override || process.env.GROK_MODEL || DEFAULT_MODEL).trim();
  return m || DEFAULT_MODEL;
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
        };
      };

      const text = data.choices?.[0]?.message?.content ?? "";
      if (!text) {
        throw new Error("Grok returned empty message content");
      }

      const usage: GrokUsage = {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
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
 * Chat completion → parse JSON (with fence / substring fallbacks).
 */
export async function grokChatCompletionJson<T>(
  options: GrokChatOptions,
): Promise<T> {
  const { text, usage, model } = await grokChatCompletion(options);
  if (usage.promptTokens + usage.completionTokens > 0) {
    console.log(
      `  · Grok tokens — model=${model} in=${usage.promptTokens} out=${usage.completionTokens}`,
    );
  }

  const jsonStr = extractJsonObject(text);
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new Error(
      `Invalid JSON from Grok (first 240 chars): ${jsonStr.slice(0, 240)}`,
    );
  }
}
