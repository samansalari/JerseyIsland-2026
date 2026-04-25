import { candidates } from "@/db/schema";
import { siteBase, truncateMetaDescription } from "@/lib/seo";

type CandidateRow = typeof candidates.$inferSelect;

type AiIssue = {
  issue: string;
  position: string;
  source_quote?: string;
  confidence?: number;
};

/**
 * Rich JSON-LD @graph for candidate profile pages.
 *
 * Schemas included:
 * - Person        — identity, affiliation, knowsAbout
 * - WebPage       — with accurate dateModified from lastEnrichedAt
 * - BreadcrumbList — navigation context
 * - FAQPage       — one Q&A per AI issue position + summary Q (AEO core)
 *                   Only present when aiIssues is non-empty.
 *                   Google AI Overviews, Perplexity, and Bing Copilot
 *                   extract directly from FAQPage mainEntity.
 */
export function generateCandidateJsonLd(
  candidate: CandidateRow,
  siteUrl?: string,
) {
  const base = siteUrl ?? siteBase();
  const pageUrl = `${base}/candidates/${candidate.slug}`;
  const personId = `${pageUrl}#person`;

  // dateModified drives Google's crawl frequency — use enrichment timestamp
  // as it is the most accurate freshness signal (updated by Grok cron).
  const dateModified = candidate.lastEnrichedAt
    ? new Date(candidate.lastEnrichedAt).toISOString()
    : candidate.updatedAt
      ? new Date(candidate.updatedAt).toISOString()
      : new Date().toISOString();

  const description =
    (candidate.aiSummary
      ? truncateMetaDescription(candidate.aiSummary, 160)
      : null) ??
    `${candidate.name} is standing in ${candidate.district} in Jersey's 2026 general election.`;

  // ── Build FAQPage mainEntity ──────────────────────────────────────────────
  const aiIssues = Array.isArray(candidate.aiIssues)
    ? (candidate.aiIssues as AiIssue[])
    : [];

  type FaqEntry = {
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  };

  const faqEntries: FaqEntry[] = [];

  // Summary Q&A at the top — "Who is X?" — surfaces the AI bio in AI answers
  if (candidate.aiSummary) {
    faqEntries.push({
      "@type": "Question",
      name: `Who is ${candidate.name} in the Jersey 2026 election?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: candidate.aiSummary,
      },
    });
  }

  // One Q&A per issue position — the AEO core payload
  for (const issue of aiIssues) {
    if (!issue.issue || !issue.position) continue;
    const issueName = issue.issue.replace(/_/g, " ");
    const answerText = issue.source_quote
      ? `${issue.position} (Source: "${issue.source_quote}")`
      : issue.position;

    faqEntries.push({
      "@type": "Question",
      name: `What is ${candidate.name}'s position on ${issueName} in the Jersey 2026 election?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: answerText,
      },
    });
  }

  // ── Person ─────────────────────────────────────────────────────────────────
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": personId,
    name: candidate.name,
    description:
      truncateMetaDescription(candidate.bio ?? candidate.aiSummary, 300) ||
      `${candidate.name} — candidate for ${candidate.district} in Jersey's 2026 general election.`,
    jobTitle: `Election Candidate, ${candidate.district || "Jersey 2026"}`,
    url: pageUrl,
    knowsAbout: [
      "Jersey politics",
      "States of Jersey",
      ...aiIssues
        .map((i) => i.issue?.replace(/_/g, " "))
        .filter((v): v is string => Boolean(v)),
    ],
    sameAs:
      candidate.sourceUrls.length > 0
        ? candidate.sourceUrls.filter(
            (u) => typeof u === "string" && u.length > 0,
          )
        : undefined,
  };

  if (candidate.photoUrl) person.image = candidate.photoUrl;
  if (candidate.party) {
    person.affiliation = { "@type": "Organization", name: candidate.party };
  }

  // ── WebPage ────────────────────────────────────────────────────────────────
  const webPage = {
    "@type": "WebPage",
    "@id": pageUrl,
    url: pageUrl,
    name: `${candidate.name} — Jersey 2026 election | VotePulse`,
    description,
    inLanguage: "en-GB",
    dateModified,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#aeo-candidate-lead"],
    },
    about: { "@id": personId },
    isPartOf: {
      "@type": "WebSite",
      "@id": `${base}/#website`,
      name: "VotePulse",
      url: base,
    },
    publisher: {
      "@type": "Organization",
      name: "VotePulse",
      url: base,
      description:
        "Non-partisan election intelligence for Jersey's 2026 general election.",
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: base },
        {
          "@type": "ListItem",
          position: 2,
          name: "Candidates",
          item: `${base}/candidates`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: candidate.name,
          item: pageUrl,
        },
      ],
    },
  };

  // ── Graph assembly ─────────────────────────────────────────────────────────
  const graph: unknown[] = [person, webPage];

  // FAQPage only added when there are entries — empty FAQPage is invalid schema
  if (faqEntries.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      dateModified,
      about: { "@id": personId },
      mainEntity: faqEntries,
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
