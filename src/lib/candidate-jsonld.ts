import { candidates } from "@/db/schema";
import { canonicalUrl, siteBase, truncateMetaDescription } from "@/lib/seo";

type CandidateRow = typeof candidates.$inferSelect;

function toIso(d: Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/**
 * Rich JSON-LD graph for candidate profile pages (Person + WebPage + BreadcrumbList).
 */
export function generateCandidateJsonLd(candidate: CandidateRow, slug: string) {
  const siteUrl = siteBase();
  const pageUrl = canonicalUrl(`/candidates/${slug}`);
  const personId = `${pageUrl}#person`;
  const websiteId = `${siteUrl}/#website`;

  const description =
    candidate.aiSummary != null && candidate.aiSummary.trim() !== ""
      ? truncateMetaDescription(candidate.aiSummary, 160)
      : `${candidate.name} is standing in ${candidate.district} in Jersey's 2026 general election.`;

  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": personId,
    name: candidate.name,
    description:
      truncateMetaDescription(candidate.bio ?? candidate.aiSummary, 300) ||
      `${candidate.name} — candidate for ${candidate.district} in Jersey's 2026 general election.`,
    jobTitle: "Election candidate",
    url: pageUrl,
    sameAs:
      candidate.sourceUrls.length > 0
        ? candidate.sourceUrls.filter((u) => typeof u === "string" && u.length > 0)
        : undefined,
  };

  if (candidate.photoUrl) {
    person.image = candidate.photoUrl;
  }

  if (candidate.party) {
    person.affiliation = {
      "@type": "Organization",
      name: candidate.party,
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: `${candidate.name} — Jersey 2026 election candidate`,
        description,
        about: { "@type": "Person", "@id": personId },
        dateModified: toIso(candidate.updatedAt),
        publisher: {
          "@type": "Organization",
          name: "VotePulse",
          url: siteUrl,
          description:
            "Non-partisan election intelligence for Jersey's 2026 general election.",
        },
        isPartOf: {
          "@type": "WebSite",
          "@id": websiteId,
          name: "VotePulse",
          url: siteUrl,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${siteUrl}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Candidates",
            item: `${siteUrl}/candidates`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: candidate.name,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
