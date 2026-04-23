import { siteBase } from "@/lib/seo";

/**
 * Site-wide structured data for the homepage (WebSite + Dataset for AEO/GEO).
 */
export function generateHomepageJsonLd() {
  const siteUrl = siteBase();
  const websiteId = `${siteUrl}/#website`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteUrl,
        name: "VotePulse",
        description:
          "Non-partisan public election intelligence platform for Jersey's 2026 general election.",
        publisher: {
          "@type": "Organization",
          name: "VotePulse",
          url: siteUrl,
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/Logo__2_.png`,
          },
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/candidates?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Dataset",
        name: "Jersey 2026 general election — candidate intelligence",
        description:
          "Structured data on candidates, policy positions, and election intelligence for Jersey's 2026 general election.",
        url: siteUrl,
        keywords: [
          "Jersey election 2026",
          "Jersey candidates",
          "States of Jersey",
          "Jersey politics",
          "election intelligence",
          "candidate comparison",
        ],
        license: "https://creativecommons.org/licenses/by/4.0/",
        creator: {
          "@type": "Organization",
          name: "VotePulse",
        },
        temporalCoverage: "2026",
        spatialCoverage: {
          "@type": "Place",
          name: "Jersey",
          sameAs: "https://en.wikipedia.org/wiki/Jersey",
        },
      },
    ],
  };
}
