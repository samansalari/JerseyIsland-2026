/**
 * Kimi K2.6 supervisor — independent reviewer of Grok-generated candidate
 * summaries.
 *
 * Pipeline:
 *   1. Grok enriches manifesto → writes `ai_summary` + `ai_issues` to DB
 *   2. This module reads (manifesto, summary) → calls Kimi K2.6 via OpenRouter
 *   3. Kimi returns a structured score + flags + (optional) corrected summary
 *   4. Caller writes the result to `candidates.reviewStatus`
 *
 * Why a separate model: Grok wrote the summary, so a second independent model
 * is the only way to catch its mistakes. Kimi K2.6 has a 256K context window —
 * we send the FULL manifesto (no truncation) so hallucination calls are well
 * grounded.
 *
 * Auth: `OPENROUTER_API_KEY` from `.env.local` / Railway env. OpenRouter is
 * OpenAI-compatible, so we use plain `fetch` — no SDK to manage.
 */

import type { ReviewFlag, ReviewStatus } from "@/db/schema";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "moonshotai/kimi-k2.6";

// Kimi K2.6's context is 256K tokens, so 8K characters fits comfortably and
// covers every manifesto we have. Anything longer than this would already have
// been truncated upstream by the scraper.
const MANIFESTO_MAX_CHARS = 8000;

export type ReviewResult = Omit<ReviewStatus, "reviewedAt" | "model"> & {
  model: string;
  reviewedAt: string;
};

// Re-export so callers can `import type { ReviewFlag } from "@/lib/supervisor"`.
export type { ReviewFlag };

const SYSTEM_PROMPT = `You are a strict, impartial political fact-checker for VotePulse — a non-partisan election intelligence platform for Jersey's 2026 general election. Jersey is a British Crown Dependency of approximately 100,000 people with 12 parishes.

You review AI-generated candidate summaries produced by xAI Grok. You are an independent model (Kimi K2.6). Your job is to catch Grok's mistakes — not to rewrite good summaries.

SCORING (1-10):
10 = Perfectly accurate, neutral, and complete
8-9 = Minor issues only — passes
6-7 = Notable issues — passes with flags for human review
4-5 = Significant problems — fails, corrected summary required
1-3 = Severe hallucination or clear bias — auto-corrected immediately

FLAG TYPES — only flag when genuinely present:

hallucination
  A specific policy claim in the summary has NO basis in the manifesto text.
  This is the most serious error.
  IMPORTANT: You have a 256K context window. Read the ENTIRE manifesto before
  flagging hallucination. If a claim is present anywhere in the text, do not flag it.
  Only flag when you are certain the claim has no basis in the provided text.

bias
  Summary uses language that adds editorial spin absent from the manifesto.
  Examples of bias: "ambitious plan", "controversial", "bold vision", "weak proposal"
  Describing what a candidate said is neutral. Judging it is bias.
  Do NOT flag a candidate's own strong language as bias in the summary.

attribution_error
  Summary attributes a position to this candidate that belongs to a different
  candidate or party. Common when AI trained on many manifestos confuses them.

incompleteness
  Summary completely ignores a major policy area the candidate emphasised.
  Only flag if the omission significantly misrepresents their priorities.
  Do NOT flag minor omissions — summaries must be concise.

inaccuracy
  Clear factual error: wrong party name, wrong district, wrong role
  (Senator/Deputy/Connétable), wrong vote numbers, wrong year.

neutrality_breach
  Summary makes a value judgement about the candidate's character,
  electability, or suitability for office.

DO NOT FLAG:
- Simplification (summaries must be short — conciseness is correct)
- Minor paraphrasing differences from source text
- Positions from historical manifestos — these are explicitly valid when
  no 2026 manifesto exists and the historical note is present
- Strong positions the candidate themselves stated

CORRECTED SUMMARY (only when score < 7):
- 2-3 sentences maximum
- Describe what the candidate said — do not judge it
- No adjectives carrying editorial weight
- Match the factual content of the manifesto

OUTPUT: Return ONLY valid JSON. No markdown fences. No preamble. No text outside the JSON.`;

const VALID_FLAG_TYPES = new Set<ReviewFlag["type"]>([
  "hallucination",
  "bias",
  "attribution_error",
  "incompleteness",
  "inaccuracy",
  "neutrality_breach",
]);
const VALID_SEVERITY = new Set<ReviewFlag["severity"]>([
  "low",
  "medium",
  "high",
]);

export type ReviewParams = {
  candidateName: string;
  district: string | null;
  party: string | null;
  role: string | null;
  manifestoRaw: string;
  aiSummary: string;
  aiIssues?: Array<{
    issue: string;
    position: string;
    sourceQuote: string;
    confidence: number;
  }>;
};

export async function reviewCandidateSummary(
  params: ReviewParams,
): Promise<ReviewResult> {
  const {
    candidateName,
    district,
    party,
    role,
    manifestoRaw,
    aiSummary,
    aiIssues,
  } = params;

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set — add it to .env.local (https://openrouter.ai/settings/keys)",
    );
  }

  const isHistorical = manifestoRaw.startsWith("[Historical manifesto");
  const manifesto = manifestoRaw.slice(0, MANIFESTO_MAX_CHARS);
  const wasTruncated = manifestoRaw.length > MANIFESTO_MAX_CHARS;

  const issueBlock =
    aiIssues && aiIssues.length > 0
      ? `\n\nAI-EXTRACTED ISSUE POSITIONS (verify these too):\n${aiIssues
          .map(
            (i) =>
              `[${i.issue}] ${i.position}\n` +
              `Source quote: "${i.sourceQuote}"\n` +
              `Confidence: ${i.confidence}`,
          )
          .join("\n\n")}`
      : "";

  const userMessage = `Review this AI-generated summary.

CANDIDATE: ${candidateName}
ROLE: ${role ?? "Unknown"}
DISTRICT: ${district ?? "N/A — Senator (island-wide)"}
PARTY: ${party ?? "Independent"}
${
  isHistorical
    ? "\nIMPORTANT: This is a HISTORICAL manifesto from a previous election. " +
      "No 2026 manifesto has been published. " +
      "Positions from historical text are valid — do NOT flag as hallucination."
    : ""
}

=== MANIFESTO TEXT (source of truth) ===
${manifesto}
${wasTruncated ? "\n[Manifesto truncated — first 8000 characters shown]" : ""}

=== AI-GENERATED SUMMARY (written by Grok — check this) ===
${aiSummary}
${issueBlock}

Return JSON with exactly these fields — no extra fields, no markdown:
{
  "score": <integer 1-10>,
  "passed": <boolean>,
  "flags": [
    {
      "type": "<hallucination|bias|attribution_error|incompleteness|inaccuracy|neutrality_breach>",
      "severity": "<low|medium|high>",
      "description": "<specific description, under 120 chars>",
      "quote": "<exact problematic text from the summary, or null>"
    }
  ],
  "correctedSummary": "<corrected 2-3 sentence summary if score < 7, else null>",
  "reasoning": "<one sentence explaining the score>"
}`;

  type OpenRouterResponse = {
    choices: Array<{
      message: { content: string | null };
      finish_reason: string;
    }>;
    provider?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  // One call to OpenRouter with a configurable token budget. Kimi K2.6 is a
  // reasoning model — completion tokens cover BOTH the internal chain of
  // thought AND the final JSON answer. If we run out of budget mid-reasoning
  // the API returns `content: null` with `finish_reason: "length"`. The
  // caller retries with a larger budget when that happens.
  //
  // Latency varies wildly by provider (Cloudflare ~90s, Parasail ~15s,
  // SiliconFlow ~20s for our payload size). We ask OpenRouter to prefer the
  // fastest provider via `provider.sort: "throughput"` and allow fallbacks
  // so a single slow node doesn't take us down. The 240s abort is a generous
  // upper bound — well under the 600s cron timeout per candidate.
  async function callOnce(maxTokens: number): Promise<OpenRouterResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240_000);
    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_SITE_URL ?? "https://votepulse.je",
          "X-Title": "VotePulse Supervisor",
        },
        body: JSON.stringify({
          model: MODEL,
          // Kimi K2.6 is a reasoning model. `max_tokens` covers BOTH the
          // internal chain-of-thought AND the final JSON answer — when
          // exhausted the API returns `content: null` with
          // `finish_reason: "length"` (retried by the caller with a bigger
          // budget). OpenRouter's `reasoning.effort` knob only works on
          // OpenAI/Grok models — passing it to a Moonshot endpoint causes
          // upstream hangs, so we just give the model room to think.
          max_tokens: maxTokens,
          temperature: 0,
          provider: {
            sort: "throughput",
            allow_fallbacks: true,
          },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(
          `OpenRouter error ${res.status}: ${errText.slice(0, 300)}`,
        );
      }
      // Read the body as text first so we can surface a useful error if the
      // upstream provider closes the connection mid-stream (we have seen
      // OpenRouter occasionally return an empty 200 — `res.json()` would
      // throw the opaque "Unexpected end of JSON input" otherwise).
      const bodyText = await res.text();
      if (!bodyText.trim()) {
        throw new Error("OpenRouter returned an empty 200 body");
      }
      try {
        return JSON.parse(bodyText) as OpenRouterResponse;
      } catch (err) {
        throw new Error(
          `OpenRouter returned non-JSON body (${(err as Error).message}): ${bodyText.slice(0, 200)}`,
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Up to 2 retries on transient network/parse errors. The 5s gap gives a
  // flaky upstream provider time to recover and lets OpenRouter route to a
  // different one on the retry.
  async function callWithRetry(maxTokens: number): Promise<OpenRouterResponse> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await callOnce(maxTokens);
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          console.warn(
            `  [kimi-k2.6] attempt ${attempt} failed (${(err as Error).message.slice(0, 100)}) — retrying in 5s`,
          );
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
    throw lastErr;
  }

  // Start with a comfortable 4000-token budget; if the model truncates
  // (reasoning ate the budget) retry once at 8000.
  let data = await callWithRetry(4000);
  let raw = data.choices?.[0]?.message?.content;
  let finish = data.choices?.[0]?.finish_reason;
  if (!raw && finish === "length") {
    console.warn(
      `  [kimi-k2.6] truncated at 4000 tokens — retrying at 8000`,
    );
    data = await callWithRetry(8000);
    raw = data.choices?.[0]?.message?.content;
    finish = data.choices?.[0]?.finish_reason;
  }
  if (!raw) {
    throw new Error(
      `Empty response from Kimi K2.6 (finish_reason=${finish ?? "unknown"})`,
    );
  }

  // Some models occasionally wrap JSON in markdown fences despite instructions
  // to the contrary; strip them defensively before parsing.
  const cleaned = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/\s*```$/im, "")
    .trim();

  let parsed: {
    score?: unknown;
    passed?: unknown;
    flags?: unknown;
    correctedSummary?: unknown;
    reasoning?: unknown;
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[supervisor] JSON parse failed:", raw.slice(0, 400));
    throw new Error(
      `Kimi K2.6 returned unparseable response: ${raw.slice(0, 120)}`,
    );
  }

  const score =
    typeof parsed.score === "number"
      ? Math.max(1, Math.min(10, Math.round(parsed.score)))
      : 5;

  const rawFlags = Array.isArray(parsed.flags) ? parsed.flags : [];
  const flags: ReviewFlag[] = rawFlags
    .filter((f): f is { type: string; severity: string } & Record<string, unknown> =>
      !!f &&
      typeof f === "object" &&
      typeof (f as { type: unknown }).type === "string" &&
      typeof (f as { severity: unknown }).severity === "string",
    )
    .filter(
      (f) =>
        VALID_FLAG_TYPES.has(f.type as ReviewFlag["type"]) &&
        VALID_SEVERITY.has(f.severity as ReviewFlag["severity"]),
    )
    .map((f) => ({
      type: f.type as ReviewFlag["type"],
      severity: f.severity as ReviewFlag["severity"],
      description:
        typeof f.description === "string"
          ? f.description.slice(0, 200)
          : "",
      quote: typeof f.quote === "string" ? f.quote.slice(0, 400) : null,
    }));

  if (data.usage) {
    const inputCost = (data.usage.prompt_tokens / 1_000_000) * 0.7448;
    const outputCost = (data.usage.completion_tokens / 1_000_000) * 4.655;
    const total = inputCost + outputCost;
    console.log(
      `  [kimi-k2.6] in:${data.usage.prompt_tokens} ` +
        `out:${data.usage.completion_tokens} ` +
        `cost:$${total.toFixed(5)}` +
        (data.provider ? ` provider:${data.provider}` : ""),
    );
  }

  const correctedSummary =
    score < 7 && typeof parsed.correctedSummary === "string"
      ? parsed.correctedSummary.trim()
      : null;

  const reasoning =
    typeof parsed.reasoning === "string"
      ? parsed.reasoning.slice(0, 300)
      : "No reasoning provided";

  return {
    score,
    passed: score >= 7,
    flags,
    correctedSummary,
    reasoning,
    model: MODEL,
    reviewedAt: new Date().toISOString(),
  };
}
