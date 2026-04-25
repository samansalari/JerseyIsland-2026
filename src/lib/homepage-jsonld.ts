import { siteBase } from "@/lib/seo";

/**
 * Rich JSON-LD @graph for the homepage.
 * Includes: WebSite (with SearchAction), Organization, Dataset, Event, FAQPage.
 * Optimised for Google AI Overviews, featured snippets, and LLM citation.
 */
export function generateHomepageJsonLd() {
  const siteUrl = siteBase();
  const websiteId = `${siteUrl}/#website`;
  const orgId = `${siteUrl}/#organization`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteUrl,
        name: "VotePulse",
        description:
          "Independent non-partisan election intelligence for Jersey's 2026 general election.",
        inLanguage: "en-GB",
        publisher: { "@id": orgId },
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
        "@type": "Organization",
        "@id": orgId,
        name: "VotePulse",
        url: siteUrl,
        description:
          "Independent non-partisan election intelligence platform for Jersey 2026.",
        areaServed: {
          "@type": "Place",
          name: "Jersey",
          sameAs: "https://en.wikipedia.org/wiki/Jersey",
        },
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/Logo__2_.png`,
        },
      },
      {
        "@type": "Dataset",
        name: "Jersey 2026 General Election Candidates Dataset",
        description:
          "AI-enriched profiles of 135 declared candidates for the Jersey 2026 general election. Includes policy positions on housing, healthcare, economy, environment and more.",
        url: `${siteUrl}/candidates`,
        creator: { "@id": orgId },
        dateModified: new Date().toISOString(),
        temporalCoverage: "2026",
        spatialCoverage: {
          "@type": "Place",
          name: "Jersey, Channel Islands",
          sameAs: "https://en.wikipedia.org/wiki/Jersey",
        },
        keywords: [
          "Jersey election 2026",
          "Jersey candidates",
          "States Assembly",
          "Deputy election",
          "Senator election",
          "Connétable election",
        ],
        license: "https://creativecommons.org/licenses/by/4.0/",
      },
      {
        "@type": "Event",
        name: "Jersey General Election 2026",
        startDate: "2026-06-07T08:00:00+01:00",
        endDate: "2026-06-07T20:00:00+01:00",
        eventStatus: "https://schema.org/EventScheduled",
        location: {
          "@type": "Place",
          name: "Jersey, Channel Islands",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Jersey",
            addressCountry: "JE",
          },
        },
        description:
          "Jersey 2026 general election — voting for Senators (island-wide), Deputies (district), and Connétables (parish).",
        url: siteUrl,
        organizer: {
          "@type": "GovernmentOrganization",
          name: "States of Jersey",
          url: "https://www.gov.je",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "When is the Jersey 2026 election?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "The Jersey general election is on Sunday 7 June 2026. Polls open at 8:00 AM Jersey Standard Time (BST). Voters elect Senators (island-wide), Deputies (district), and Connétables (parish).",
            },
          },
          {
            "@type": "Question",
            name: "How many candidates are standing in Jersey 2026?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "VotePulse tracks 135 declared candidates for the Jersey 2026 general election across 14 electoral districts and parishes.",
            },
          },
          {
            "@type": "Question",
            name: "What parties are standing in Jersey 2026?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Reform Jersey is the main political party. Most candidates stand as independents. Jersey operates a largely non-partisan political system where candidates are elected on personal manifestos.",
            },
          },
          {
            "@type": "Question",
            name: "How can I compare Jersey 2026 candidates?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "VotePulse lets you select up to 4 candidates and compare their AI-extracted policy positions across 10 issues: housing, healthcare, cost of living, economy, environment, education, transport, tax, public services, and immigration. Visit votepulse.je/compare.",
            },
          },
          {
            "@type": "Question",
            name: "What electoral districts are in Jersey 2026?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Jersey's 14 electoral districts for 2026 are: St Helier North, St Helier Central, St Helier South, St Saviour, St Brelade, St Clement, St Peter, St Lawrence, St Mary, St Ouen, St John, Trinity, Grouville, and St Martin.",
            },
          },
        ],
      },
    ],
  };
}
