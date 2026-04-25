/**
 * Validation and display helpers for candidate names.
 * Pure TypeScript — no server deps, safe to import in any component.
 */

/**
 * Validates that a candidate name looks like a real person's name.
 * Returns true if the name is acceptable to display.
 */
export function isValidCandidateName(name: string): boolean {
  if (!name || name.trim().length === 0) return false;

  const trimmed = name.trim();

  if (trimmed.length < 3) return false;
  if (trimmed.length > 80) return false;

  // Contains email address
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed))
    return false;

  // Contains a URL
  if (/https?:\/\//.test(trimmed)) return false;

  // Contains website domain patterns
  if (/flow\.je|vote\.je|\.com\/|\.co\.uk\//.test(trimmed)) return false;

  // Is all uppercase (usually nav/header text) — only flag if longer than 10 chars
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 10) return false;

  // Contains nav keywords
  if (
    /\b(Home|Contact|Privacy|Cookie|Terms|About|Register|Login)\b/i.test(
      trimmed,
    )
  )
    return false;

  return true;
}

/**
 * Returns a display-safe name. If the stored name fails validation,
 * returns "Candidate" as a neutral fallback rather than showing garbage.
 */
export function safeDisplayName(name: string): string {
  return isValidCandidateName(name) ? name.trim() : "Candidate";
}
