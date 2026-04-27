/**
 * Render-time cleanup for candidate.manifestoRaw.
 *
 * The importer stores the FULL markdown (incl. flow.je nav and the
 * `## Election History` section) so that Grok / future tooling has the
 * complete context. The candidate page renders this column via
 * react-markdown, but the nav and the historical results tables would
 * look ugly there — those are handled by other UI sections instead.
 *
 * This helper:
 *   1. Cuts everything from the `## Election History` heading onward
 *      (rendered by the structured Election History section).
 *   2. Strips the leading flow.je nav (breadcrumb header, "Menu", and
 *      bare-link list items).
 *   3. Removes horizontal-rule artefacts and the flow.je footer.
 *
 * It deliberately preserves any prose biography or 2026 manifesto text
 * that sits between the nav and `## Election History`.
 */
export function cleanManifestoForDisplay(markdown: string): string {
  if (!markdown) return "";

  // 1. Cut at the Election History section (rendered separately).
  let content = markdown.split(/^##\s+Election History/im)[0] ?? markdown;

  // 2. Strip the leading flow.je navigation block.
  const lines = content.split("\n");
  const cleanedLines: string[] = [];
  let pastNav = false;

  for (const line of lines) {
    const t = line.trim();

    if (!pastNav) {
      if (!t) continue;
      if (t.startsWith("# [flow.je]")) continue;
      if (t === "Menu") continue;
      // Bare-link bullets (top-level or nested) are nav items.
      if (/^[-*]\s+\[[^\]]+\]\([^)]+\)\s*$/.test(t)) continue;
      pastNav = true;
    }

    cleanedLines.push(line);
  }

  content = cleanedLines.join("\n");

  // 3. Strip flow.je footer artefacts and empty horizontal rules.
  content = content
    .replace(/^---+$/gm, "")
    .replace(/^\*\*\*+$/gm, "")
    .replace(/^\s*\*\s+\*\s+\*\s*$/gm, "")
    .replace(/^©.*$/gm, "")
    .replace(/^Return to Top.*$/gim, "")
    .replace(/\[© \d{4}-\d{4}\]\([^)]+\)\s*\[hello@flow\.je\][^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return content;
}
