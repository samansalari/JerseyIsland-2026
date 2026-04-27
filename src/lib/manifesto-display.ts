/**
 * @deprecated Use `@/lib/clean-manifesto` instead.
 *
 * This module is kept as a re-export shim for compatibility — the
 * implementation now lives in `clean-manifesto.ts` and additionally
 * strips vote.je icon-label noise that Firecrawl picks up from page
 * headers. Prefer importing directly from `@/lib/clean-manifesto`
 * in new code.
 */
export { cleanManifestoForDisplay } from "./clean-manifesto";
