"use client";

import { useState } from "react";
import { cleanManifestoForDisplay } from "@/lib/clean-manifesto";

/**
 * Approximate character budget for the collapsed preview. Roughly equal
 * to ~120 words for our typography (5 chars/word ≈ 600).
 */
const PREVIEW_CHARS = 600;

type Block =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string };

/**
 * Render a cleaned manifesto with proper typographic structure.
 *
 * Uses `cleanManifestoForDisplay` to strip nav/icon noise and trim
 * historical prefixes, then parses the remaining markdown into
 * Heading / Subheading / Paragraph blocks. Long manifestos collapse
 * to a preview with a "Read full manifesto" toggle.
 */
export function ManifestoContent({ raw }: { raw: string }) {
  const [expanded, setExpanded] = useState(false);

  const cleaned = cleanManifestoForDisplay(raw);
  const blocks = parseManifestoBlocks(cleaned);

  // Use cleaned-text length (post-noise-strip) as the threshold so the
  // expand button corresponds to what the user actually sees.
  const isLong = cleaned.length > PREVIEW_CHARS;
  const visibleBlocks =
    expanded || !isLong ? blocks : truncateBlocks(blocks, PREVIEW_CHARS);

  // Rough word count for the CTA copy. Average word ≈ 5 chars including space.
  const wordCount = Math.max(1, Math.ceil(cleaned.length / 5));

  return (
    <div className="px-5 py-5">
      <div className="manifesto-prose space-y-3 text-sm leading-relaxed text-[#0D1B2A]/80">
        {visibleBlocks.map((block, i) => {
          if (block.type === "heading") {
            return (
              <h3
                key={i}
                className="mt-6 border-b border-gray-100 pb-1 text-base font-bold text-[#0D1B2A] first:mt-0"
              >
                {block.text}
              </h3>
            );
          }
          if (block.type === "subheading") {
            return (
              <h4
                key={i}
                className="mt-4 text-sm font-semibold text-[#0D1B2A]"
              >
                {block.text}
              </h4>
            );
          }
          if (block.type === "paragraph" && block.text.trim()) {
            return (
              <p
                key={i}
                className="leading-relaxed text-[#0D1B2A]/75 [text-wrap:pretty]"
              >
                {block.text}
              </p>
            );
          }
          return null;
        })}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="group mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#0D1B2A]/50 transition-colors hover:text-[#A31621]"
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
          {expanded
            ? "Show less"
            : `Read full manifesto (${wordCount.toLocaleString()} words)`}
        </button>
      )}
    </div>
  );
}

// ── Block parser ────────────────────────────────────────────────────────────

/**
 * Walk the cleaned text line-by-line and group it into structured blocks.
 *
 * Detection rules (in priority order):
 *   1. `# Heading` / `## Heading`  → `heading`
 *   2. `### Sub` / `#### Sub`      → `subheading`
 *   3. Bold-only short line `**…**`→ `subheading`
 *   4. Anything else accumulates into a `paragraph` block until a blank line.
 *
 * Inline markdown (`**bold**`, `*italic*`, `` `code` ``) inside paragraph
 * text is stripped down to plain text — we render typographically, not
 * as live markdown.
 */
function parseManifestoBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) blocks.push({ type: "paragraph", text: trimmed });
    current = "";
  };

  for (const line of lines) {
    const t = line.trim();

    if (!t) {
      flush();
      continue;
    }

    const heading = t.match(/^#{1,2}\s+(.+)$/);
    if (heading) {
      flush();
      blocks.push({ type: "heading", text: cleanInline(heading[1]!) });
      continue;
    }

    const sub = t.match(/^#{3,4}\s+(.+)$/);
    if (sub) {
      flush();
      blocks.push({ type: "subheading", text: cleanInline(sub[1]!) });
      continue;
    }

    // A short line that is purely "**Heading**" (or with trailing colon) is
    // a section header in vote.je manifestos like "**Housing**".
    const boldHeading = t.match(/^\*\*([^*]+)\*\*:?\s*$/);
    if (boldHeading && t.length < 80) {
      flush();
      blocks.push({ type: "subheading", text: boldHeading[1]!.trim() });
      continue;
    }

    const cleanedLine = cleanInline(t);
    current += (current ? " " : "") + cleanedLine;
  }

  flush();

  return blocks.filter((b) => b.text.trim().length > 0);
}

/** Strip inline markdown markers (bold, italic, code) for plain rendering. */
function cleanInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\s)([^*]+?)\*(?!\*)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/**
 * Truncate the block list to roughly `maxChars` of visible text. Always
 * returns at least one block so the preview is never empty.
 */
function truncateBlocks(blocks: Block[], maxChars: number): Block[] {
  const out: Block[] = [];
  let count = 0;
  for (const block of blocks) {
    out.push(block);
    count += block.text.length;
    if (count >= maxChars) break;
  }
  return out.length > 0 ? out : blocks.slice(0, 1);
}
