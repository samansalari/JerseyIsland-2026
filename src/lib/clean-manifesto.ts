/**
 * VotePulse — Manifesto cleaning utilities
 *
 * Two cleaning surfaces:
 *
 *  1. `cleanManifestoForStorage` — applied at ingest time (scraper + importer)
 *     and by the one-off DB cleaner. Strips Firecrawl/vote.je/flow.je nav
 *     boilerplate and SVG icon-label noise without touching real markdown
 *     structure (headings, bold, paragraphs). Preserves the
 *     `[Historical manifesto …]` prefix so Phase-2 records stay tagged.
 *
 *  2. `cleanManifestoForDisplay` — applied at render time before parsing
 *     into structured blocks. Adds:
 *       • cuts at `## Election History` (rendered by a dedicated UI section
 *         from `electionHistory` JSONB)
 *       • removes the historical prefix (the candidate page renders that
 *         as a styled amber notice instead)
 *       • strips raw URLs, image syntax, horizontal rules, markdown links
 *
 *     Importantly it KEEPS markdown headings (`##`) and bold (`**…**`)
 *     intact so the React block parser in `<ManifestoContent />` can
 *     turn them into proper `<h3>` / `<h4>` typography.
 */

// ── Patterns that indicate vote.je / flow.je nav noise ──────────────────────

const VOTE_JE_NAV_NOISE_PATTERNS: RegExp[] = [
  // SVG icon label text from vote.je nav (Firecrawl renders the alt-text
  // of header icons as plain words like "Twitter icon").
  /(?:Twitter|Facebook|Youtube|YouTube|Instagram|LinkedIn|TikTok)\s+icon/gi,
  /(?:Mobile navigation|Close|Chevron|Search|Arrow|Divider|Tick)\s+icon/gi,
  /(?:Filter bars|Quote|Flag|Globe|Phone|Menu)\s+icon/gi,

  // vote.je accessibility / nav strings
  /return back to the homepage/gi,
  /close navigation/gi,
  /Toggle search bar/gi,
  /Toggle navigation/gi,
  /Submit search form/gi,

  // Lines that are 3+ "Word icon" patterns concatenated together.
  /^(?:\w+\s+icon){3,}.*$/gm,

  // Orphaned single-word vote.je nav artefacts left behind when adjacent
  // "Word icon" matches strip out (e.g. "Arrow iconDividerTick icon" → after
  // matching "Arrow icon" and "Tick icon" we'd be left with "Divider").
  /^\s*(?:Twitter|Facebook|Youtube|YouTube|Instagram|LinkedIn|TikTok|Mobile navigation|Close|Chevron|Search|Arrow|Divider|Tick|Filter bars|Quote|Flag|Globe|Phone|Menu)\s*$/gim,

  // vote.je footer block (address → email)
  /Morier House[\s\S]*?contact@vote\.je/gi,
  /01534\s?441020/g,
  /Accessibility[\s\S]*?Terms and Conditions/gi,

  // flow.je breadcrumb
  /flow\.je\s*\/\s*elections\s*\/\s*candidates/gi,

  // Stat line that belongs in the Election History card, not the manifesto.
  /has participated in \d+ elections? since \d{4}/gi,

  // ── YouTube embed boilerplate ────────────────────────────────────────────
  // vote.je embeds an autoplay YouTube player on candidate pages. Firecrawl
  // renders the title bar, "Tap to unmute" hint, channel header, thumbnail
  // and "Watch on" link as raw markdown alongside the real manifesto, e.g.
  //
  //   PROFILE Jason Lagadu - YouTube
  //
  //   Tap to unmute
  //
  //   [PROFILE Jason Lagadu](https://www.youtube.com/watch?v=…)
  //   [Vote Jersey](https://www.youtube.com/channel/…)
  //
  //   ![thumbnail-image](https://yt3.ggpht.com/…)
  //
  //   Vote Jersey287 subscribers
  //
  //   [Watch on](https://www.youtube.com/watch?v=…)
  //
  // None of this is candidate-authored text — strip it before storage so it
  // never reaches Grok or the manifesto card.
  /^.+\s-\sYouTube\s*$/gim,
  /^Tap to unmute\s*$/gim,
  /\[[^\]]+\]\(https?:\/\/(?:www\.)?youtube\.com[^)]*\)/gi,
  /!\[thumbnail-image\]\([^)]+\)/gi,
  /^Vote Jersey\s*\d+\s+subscribers?\s*$/gim,
];

// Marker we prepend in Phase 2 of the vote.je scraper for historical manifestos.
// Kept loose: real prefix is e.g.
//   "[Historical manifesto from vote.je — 2016 election. No 2026 manifesto published yet.]"
// We tolerate any year and any trailing copy inside the brackets.
const HISTORICAL_PREFIX_PATTERN = /^\[Historical manifesto from vote\.je[\s\S]*?\]\n\n?/i;

// ── Storage cleaner ─────────────────────────────────────────────────────────

/**
 * Clean raw scraped text for storage in `candidates.manifestoRaw`.
 *
 * Removes navigation noise, icon labels, footer boilerplate, but PRESERVES:
 *   • markdown headings (`#`, `##`, `###`)
 *   • bold / italic markers
 *   • paragraph structure
 *   • the `[Historical manifesto …]` prefix (re-prepended at the end)
 *
 * Safe to call multiple times (idempotent).
 */
export function cleanManifestoForStorage(raw: string | null | undefined): string {
  if (!raw) return "";
  if (raw.trim().length === 0) return raw;

  // Preserve the historical prefix: pull it off, clean the body, glue back on.
  const historicalMatch = raw.match(HISTORICAL_PREFIX_PATTERN);
  const prefix = historicalMatch ? historicalMatch[0] : "";
  let cleaned = prefix ? raw.slice(prefix.length) : raw;

  for (const pattern of VOTE_JE_NAV_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Drop lines that are dominated by "Word icon" phrases (vote.je header) and
  // very-short single-character lines that survive icon stripping. Also
  // normalise whitespace-only lines so they don't survive the blank-line
  // collapse below as a stray gap (e.g. ` ` between `\n\n` and `\n\n`).
  cleaned = cleaned
    .split("\n")
    .map((line) => (line.trim().length === 0 ? "" : line))
    .filter((line) => {
      const trimmed = line.trim();
      const iconLabelCount = (trimmed.match(/\w+\s+icon/gi) ?? []).length;
      if (iconLabelCount >= 2) return false;
      if (trimmed.length > 0 && trimmed.length < 3) return false;
      return true;
    })
    .join("\n");

  // Collapse runs of blank lines into at most one blank line.
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  // Older Phase-2 records sometimes embedded the source as a markdown link in
  // the prefix itself (`[vote.je](http://vote.je)`). The candidate page renders
  // the prefix as plain amber-notice text, so the brackets/url leak through.
  // Defang any such link inside the preserved prefix.
  const cleanedPrefix = prefix.replace(/\[vote\.je\]\([^)]+\)/gi, "vote.je");

  return cleanedPrefix + cleaned;
}

// ── Display cleaner ─────────────────────────────────────────────────────────

/**
 * Cut everything from `## Election History` onward — it's rendered by the
 * dedicated Election History section in the candidate page, and would be
 * duplicated (and ugly) inside the manifesto block.
 */
function stripElectionHistorySection(text: string): string {
  return text.split(/^##\s+Election History/im)[0] ?? text;
}

/**
 * Strip the leading flow.je nav block (breadcrumb header, "Menu" line and
 * bare-link bullets) that survives `cleanManifestoForStorage`.
 */
function stripFlowJeNav(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let pastNav = false;

  for (const line of lines) {
    const t = line.trim();
    if (!pastNav) {
      if (!t) continue;
      if (t.startsWith("# [flow.je]")) continue;
      if (t === "Menu") continue;
      // Bare-link bullets are nav items.
      if (/^[-*]\s+\[[^\]]+\]\([^)]+\)\s*$/.test(t)) continue;
      pastNav = true;
    }
    out.push(line);
  }

  return out.join("\n");
}

/**
 * Clean and lightly format manifesto text for UI display.
 *
 * KEEPS markdown headings (`#`, `##`, `###`) and bold (`**…**`) so that the
 * block parser in `<ManifestoContent />` can render them as styled `<h3>` /
 * `<h4>` / `<p>` elements. Removes:
 *   • the `[Historical manifesto …]` prefix (rendered as a separate amber
 *     notice on the page)
 *   • flow.je footer artefacts and horizontal rules
 *   • markdown links → just the link text
 *   • standalone URLs (often broken or noisy)
 *   • markdown image syntax
 *   • icon-label lines that survived storage cleaning
 *   • the `## Election History` section onward
 */
export function cleanManifestoForDisplay(raw: string | null | undefined): string {
  if (!raw) return "";

  let text = cleanManifestoForStorage(raw);

  // Drop the prefix — UI shows it as a styled notice instead.
  text = text.replace(HISTORICAL_PREFIX_PATTERN, "");

  // Cut Election History (rendered separately).
  text = stripElectionHistorySection(text);

  // Strip leading flow.je nav block.
  text = stripFlowJeNav(text);

  // Collapse markdown links: [text](url) → text. Keep heading and bold markers.
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Markdown images.
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  // Standalone bare URLs.
  text = text.replace(/https?:\/\/\S+/g, "");

  // Horizontal rules.
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");
  text = text.replace(/^\s*\*\s+\*\s+\*\s*$/gm, "");

  // flow.je footer artefacts.
  text = text.replace(/^©.*$/gm, "");
  text = text.replace(/^Return to Top.*$/gim, "");

  // Final pass: drop residual icon-label lines and strays. Keep blank lines
  // intact for paragraph spacing.
  text = text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.length === 0) return true;
      const iconLabelCount = (trimmed.match(/\w+\s+icon/gi) ?? []).length;
      if (iconLabelCount >= 2) return false;
      // Tiny fragment lines that are not list/numeric markers.
      if (trimmed.length < 4 && !/^\d/.test(trimmed) && !/^[#*-]/.test(trimmed)) {
        return false;
      }
      return true;
    })
    .join("\n");

  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

// ── Meaningfulness check ────────────────────────────────────────────────────

/**
 * Returns true if `manifestoRaw` is essentially empty after cleaning.
 * Used by the page (and future Grok gating) to skip a render entirely
 * when the candidate has no usable text.
 */
export function isManifestoMeaningless(raw: string | null | undefined): boolean {
  if (!raw || raw.trim().length === 0) return true;

  const cleaned = cleanManifestoForDisplay(raw);

  if (cleaned.length < 100) return true;

  // Just the prefix with nothing material after it.
  if (/^\[Historical manifesto[\s\S]{0,100}$/.test(cleaned)) return true;

  return false;
}
