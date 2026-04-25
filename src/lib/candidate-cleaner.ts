/**
 * AI-powered data quality gate for scraped candidate data.
 * Runs before enrichment. Strips website boilerplate, nav, emails,
 * phone numbers, and other non-candidate content from Firecrawl output.
 */

import { grokChatCompletionJson } from "./grok";

export interface RawScrapedData {
  rawName: string; // whatever is in the name field — may be dirty
  rawBio: string | null; // whatever is in bio — may contain nav/footer junk
  rawManifesto: string | null; // manifesto_raw — may contain full page markdown
  sourceUrl: string | null; // where it came from
}

export interface CleanedCandidateData {
  name: string; // Full legal name only. E.g. "John Smith"
  bio: string | null; // Personal bio paragraph only. null if not found.
  manifestoRaw: string | null; // Policies/manifesto only. null if not found.
  wasModified: boolean; // true if any field was changed by cleaning
  issues: string[]; // list of problems found (for logging)
}

const SYSTEM_PROMPT = `You are a data quality assistant for VotePulse, a Jersey election intelligence platform. You receive raw scraped webpage content from candidate websites and must extract ONLY the candidate's actual information.

Your job is to REMOVE:
- Email addresses (anything@anything.com/je/uk/etc)
- Phone numbers
- Website navigation menus and links
- Footer text (copyright, privacy policy, terms, sitemap)
- Cookie banners and GDPR notices
- Social media profile links (Facebook, Twitter/X, Instagram, LinkedIn URLs)
- "Contact us", "About us", "Home", "Back to top" nav items
- Share buttons and sharing text
- Any content clearly not written by or about the candidate
- HTML artifacts, markdown link syntax like [text](url)
- Website domain names (flow.je, vote.je, etc.) appearing as content

Your job is to KEEP:
- The candidate's full legal name (first name + last name)
- Their personal biography or "About me" section
- Their policy positions and manifesto content
- Direct quotes from the candidate about their policies
- Their stated pledges and commitments

CRITICAL RULES:
1. For the name field: return ONLY the candidate's full name. Not "Vote for John Smith". Not "John Smith | Flow.je". Just "John Smith".
2. If you cannot confidently identify the candidate's name, return null for name.
3. For bio: return the personal biography paragraph only, NOT the website intro.
4. For manifesto: return only policy text. Remove any intro like "Welcome to my campaign website."
5. Never add content that wasn't in the original text.
6. Never hallucinate information — only extract what's actually there.`;

export async function cleanCandidateData(
  raw: RawScrapedData,
): Promise<CleanedCandidateData> {
  const userPrompt = `Clean the following scraped candidate data for Jersey 2026 election.

RAW NAME: ${raw.rawName || "(empty)"}

RAW BIO:
${raw.rawBio || "(empty)"}

RAW MANIFESTO (first 3000 chars):
${raw.rawManifesto ? raw.rawManifesto.slice(0, 3000) : "(empty)"}

SOURCE URL: ${raw.sourceUrl || "(unknown)"}

Return ONLY a JSON object. No markdown. No preamble:
{
  "name": "Full candidate name OR null if cannot determine",
  "bio": "Cleaned bio paragraph OR null if none found",
  "manifestoRaw": "Cleaned manifesto/policy text OR null if none found",
  "issues": ["list of problems found, e.g. 'email address removed', 'nav text stripped'"]
}`;

  try {
    const { data: result } = await grokChatCompletionJson<{
      name: string | null;
      bio: string | null;
      manifestoRaw: string | null;
      issues: string[];
    }>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0,
      maxTokens: 2048,
    });

    const originalName = raw.rawName?.trim() ?? "";
    const cleanName = result.name?.trim() ?? "";
    const cleanBio = result.bio?.trim() ?? null;
    const cleanManifesto = result.manifestoRaw?.trim() ?? null;

    const wasModified =
      cleanName !== originalName ||
      cleanBio !== (raw.rawBio?.trim() ?? null) ||
      cleanManifesto !== (raw.rawManifesto?.trim() ?? null);

    return {
      name: cleanName || originalName, // fallback to original if cleaning returned empty
      bio: cleanBio,
      manifestoRaw: cleanManifesto,
      wasModified,
      issues: result.issues ?? [],
    };
  } catch (err) {
    console.error("[candidate-cleaner] Grok error:", err);
    // On failure: return original data unchanged rather than breaking the pipeline
    return {
      name: raw.rawName?.trim() ?? "Unknown",
      bio: raw.rawBio?.trim() ?? null,
      manifestoRaw: raw.rawManifesto?.trim() ?? null,
      wasModified: false,
      issues: [`cleaner-error: ${String(err)}`],
    };
  }
}

/**
 * Quick regex-based pre-check to detect obviously dirty data
 * without making an API call. Returns true if the data likely
 * needs cleaning.
 */
export function looksLikeDirtyData(
  name: string,
  bio: string | null,
  manifesto: string | null,
): boolean {
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const NAV_PATTERNS =
    /\b(Home|About|Contact|Privacy Policy|Cookie Policy|Terms|Sitemap|Login|Register|Back to top)\b/i;
  const URL_IN_TEXT = /https?:\/\/[^\s]+/;
  const DOMAIN_LEAK = /flow\.je|vote\.je|policy\.je/i;

  return (
    EMAIL_REGEX.test(name) ||
    NAV_PATTERNS.test(name) ||
    URL_IN_TEXT.test(name) ||
    DOMAIN_LEAK.test(name) ||
    name.length > 60 // names shouldn't be this long
  );
}
