import { candidates } from "@/db/schema";
import { canonicalUrl, siteBase, truncateMetaDescription } from "@/lib/seo";

type CandidateRow = typeof candidates.$inferSelect;

function toIso(d: Date | null | undefined): string {
  if (!d) return new Date().toISOString();
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

/**
 * Rich JSON-LD @graph for candidate profile pages.
 * Includes: Person, WebPage, BreadcrumbList, FAQPage (from AI issues — strong AEO signal).
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

  // Build knowsAbout from ai_issues
  type AiIssue = { issue: string; position: string; confidence?: number };
  const aiIssues = Array.isArray(candidate.aiIssues)
    ? (candidate.aiIssues as AiIssue[])
    : [];

  const knowsAbout = [
    "Jersey politics",
    "States of Jersey",
    ...aiIssues
      .map((i) => i.issue?.replace(/_/g, " "))
      .filter((v): v is string => Boolean(v)),
  ];

  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": personId,
    name: candidate.name,
    description:
      truncateMetaDescription(candidate.bio ?? candidate.aiSummary, 300) ||
      `${candidate.name} — candidate for ${candidate.district} in Jersey's 2026 general election.`,
    jobTitle: `Election Candidate, ${candidate.district || "Jersey 2026"}`,
    url: pageUrl,
    knowsAbout,
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

  const graph: unknown[] = [
    person,
    {
      "@type": "WebPage",
      "@id": pageUrl,
      url: pageUrl,
      name: `${candidate.name} — Jersey 2026 election | VotePulse`,
      description,
      inLanguage: "en-GB",
      dateModified: toIso(candidate.updatedAt),
      about: { "@type": "Person", "@id": personId },
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
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: "Candidates",
            item: `${siteUrl}/candidates`,
          },
          { "@type": "ListItem", position: 3, name: candidate.name, item: pageUrl },
        ],
      },
    },
  ];

  // FAQPage from AI issues — strong signal for Google AI Overviews + featured snippets
  if (aiIssues.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: aiIssues.map((issue) => ({
        "@type": "Question",
        name: `What is ${candidate.name}'s position on ${issue.issue?.replace(/_/g, " ")}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: issue.position || "No data available.",
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
