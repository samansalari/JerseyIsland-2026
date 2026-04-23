import type { MetadataRoute } from "next";
import { siteBase } from "@/lib/seo";

/**
 * Public content is crawlable; admin and revalidation API are blocked from indexing.
 * Explicit rules for common AI/search crawlers mirror the default allow policy.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteBase();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/admin", "/api/revalidate"],
      },
      { userAgent: "GPTBot", allow: "/" },
      { userAgent: "Claude-Web", allow: "/" },
      { userAgent: "PerplexityBot", allow: "/" },
      { userAgent: "Googlebot", allow: "/" },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: new URL(base).host,
  };
}
