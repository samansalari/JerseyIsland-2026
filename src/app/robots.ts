import type { MetadataRoute } from "next";

/**
 * Crawl rules for search engines and AI indexers.
 * Admin and internal API routes are blocked; all public content is open.
 * Explicit allow rules for AI crawlers ensure ChatGPT, Perplexity, Claude
 * and Gemini can index and cite VotePulse content.
 */
export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://votepulse.je";

  return {
    rules: [
      // Default: allow all, block admin + internal API
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/admin", "/api/admin/", "/api/revalidate"],
      },
      // Standard search engines
      { userAgent: "Googlebot", allow: "/" },
      { userAgent: "Bingbot", allow: "/" },
      { userAgent: "Applebot", allow: "/" },
      { userAgent: "GoogleOther", allow: "/" },
      { userAgent: "Google-Extended", allow: "/" },
      // AI crawlers — required for ChatGPT, Perplexity, Claude, Gemini citations
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "ChatGPT-User", allow: "/" },
      { userAgent: "ClaudeBot", allow: "/" },
      { userAgent: "Claude-Web", allow: "/" },
      { userAgent: "anthropic-ai", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Amazonbot", allow: "/" },
      { userAgent: "cohere-ai", allow: "/" },
      { userAgent: "Meta-ExternalAgent", allow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: new URL(base).host,
  };
}
