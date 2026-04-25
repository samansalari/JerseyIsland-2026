"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface IssueData {
  issue: string;
  position: string;
  source_quote?: string;
  confidence: number;
}

export interface CandidateCompare {
  id: string;
  name: string;
  slug: string;
  district: string;
  party: string | null;
  bio: string | null;
  photoUrl: string | null;
  aiSummary: string | null;
  aiIssues: IssueData[] | null;
  manifestoUrl: string | null;
  sourceUrls: string[];
}

export const ALL_ISSUES = [
  { key: "housing", label: "Housing", icon: "🏠" },
  { key: "healthcare", label: "Healthcare", icon: "🏥" },
  { key: "tax", label: "Tax & finance", icon: "💰" },
  { key: "education", label: "Education", icon: "📚" },
  { key: "environment", label: "Environment", icon: "🌿" },
  { key: "transport", label: "Transport", icon: "🚌" },
  { key: "cost_of_living", label: "Cost of living", icon: "🛒" },
  { key: "immigration", label: "Immigration", icon: "🌍" },
  { key: "economy", label: "Economy", icon: "📈" },
  { key: "public_services", label: "Public services", icon: "🏛️" },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const high = confidence > 0.8;
  const med = confidence > 0.5;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: high
          ? "rgba(26,107,58,0.1)"
          : med
            ? "rgba(200,146,42,0.1)"
            : "rgba(163,22,33,0.1)",
        color: high ? "#1A6B3A" : med ? "#C8922A" : "#A31621",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: high ? "#1A6B3A" : med ? "#C8922A" : "#A31621",
        }}
      />
      {high ? "High" : med ? "Medium" : "Low"}
    </span>
  );
}

function IssueCell({ issueData }: { issueData: IssueData | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!issueData) {
    return (
      <div className="flex h-full items-center justify-center py-4">
        <span className="text-sm italic text-gray-300">No position found</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <ConfidenceBadge confidence={issueData.confidence} />
      </div>
      <p className="text-sm leading-relaxed text-gray-700">{issueData.position}</p>
      {issueData.source_quote ? (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
            style={{ color: "#C8922A" }}
          >
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            {expanded ? "Hide" : "View"} source quote
          </button>
          {expanded ? (
            <blockquote
              className="mt-2 border-l-2 pl-3 text-xs italic leading-relaxed text-gray-600"
              style={{ borderColor: "#C8922A" }}
            >
              &ldquo;{issueData.source_quote}&rdquo;
            </blockquote>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SummaryCell({
  summary,
  slug,
}: {
  summary: string | null;
  slug: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!summary) {
    return (
      <span className="text-xs italic text-gray-300">
        Summary not yet generated
      </span>
    );
  }
  return (
    <div className="text-sm leading-relaxed text-gray-600">
      <p className={expanded ? "" : "line-clamp-3"}>{summary}</p>
      {summary.length > 180 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-[#A31621] hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
      <div className="mt-2">
        <Link
          href={`/candidates/${slug}`}
          className="text-xs font-medium text-[#A31621] hover:underline"
        >
          Full profile →
        </Link>
      </div>
    </div>
  );
}

function SourceLinksCell({ candidate }: { candidate: CandidateCompare }) {
  const links = useMemo(() => {
    const raw = [...(candidate.sourceUrls ?? [])];
    if (candidate.manifestoUrl) raw.unshift(candidate.manifestoUrl);
    return [...new Set(raw.filter(Boolean))];
  }, [candidate.manifestoUrl, candidate.sourceUrls]);

  return (
    <div className="space-y-1.5 p-4">
      {candidate.manifestoUrl ? (
        <a
          href={candidate.manifestoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-[#A31621] hover:underline"
        >
          <svg
            className="h-3 w-3 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Manifesto / profile ↗
        </a>
      ) : null}
      {links
        .filter((u) => u !== candidate.manifestoUrl)
        .slice(0, 6)
        .map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-gray-500 hover:text-[#A31621] hover:underline"
          >
            {url.replace(/^https?:\/\//, "").slice(0, 48)}
            {url.length > 52 ? "…" : ""}
          </a>
        ))}
      <Link
        href={`/candidates/${candidate.slug}`}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 hover:underline"
      >
        Candidate page →
      </Link>
    </div>
  );
}

export function ComparisonTable({ candidates }: { candidates: CandidateCompare[] }) {
  const cols = candidates.length;
  const gridCols = `minmax(160px,180px) repeat(${cols}, minmax(220px,1fr))`;

  function getIssue(candidate: CandidateCompare, issueKey: string) {
    return candidate.aiIssues?.find((i) => i.issue === issueKey);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${180 + cols * 260}px` }}>
          {/* Headers */}
          <div
            className="grid border-b-2 border-gray-200 bg-gray-50"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="border-r border-gray-200 p-4" />
            {candidates.map((c) => (
              <div
                key={c.id}
                className="border-r border-gray-100 p-4 last:border-r-0"
              >
                <div className="flex items-center gap-3">
                  {c.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.photoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{ backgroundColor: "#A31621", color: "#F5E8C8" }}
                    >
                      {initials(c.name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link
                      href={`/candidates/${c.slug}`}
                      className="block truncate text-sm font-semibold text-[#0D1B2A] hover:underline"
                    >
                      {c.name}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div
            className="grid border-b border-gray-100"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div
              className="flex items-center border-r border-gray-200 bg-[#fafafa] p-4"
            >
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Summary
              </span>
            </div>
            {candidates.map((c) => (
              <div
                key={c.id}
                className="border-r border-gray-100 p-4 last:border-r-0"
              >
                <SummaryCell summary={c.aiSummary} slug={c.slug} />
              </div>
            ))}
          </div>

          {/* District & role */}
          <div
            className="grid border-b border-gray-100"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="flex items-start border-r border-gray-200 bg-[#fafafa] p-4">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                District &amp; role
              </span>
            </div>
            {candidates.map((c) => (
              <div
                key={c.id}
                className="border-r border-gray-100 p-4 text-sm last:border-r-0"
              >
                <p className="font-medium text-[#0D1B2A]">{c.district}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  Candidate for the States Assembly (2026).
                </p>
                {c.bio ? (
                  <p className="mt-2 line-clamp-2 text-xs text-gray-600">{c.bio}</p>
                ) : null}
              </div>
            ))}
          </div>

          {/* Party */}
          <div
            className="grid border-b border-gray-100"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="flex items-center border-r border-gray-200 bg-[#fafafa] p-4">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Party
              </span>
            </div>
            {candidates.map((c) => (
              <div
                key={c.id}
                className="border-r border-gray-100 p-4 text-sm last:border-r-0"
              >
                {c.party ? (
                  <span className="font-medium text-[#A31621]">{c.party}</span>
                ) : (
                  <span className="text-xs italic text-gray-300">
                    Not listed
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Issues — always 10 rows */}
          {ALL_ISSUES.map((issue, idx) => (
            <div
              key={issue.key}
              className="grid border-b border-gray-100 last:border-b-0"
              style={{
                gridTemplateColumns: gridCols,
                backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
              }}
            >
              <div
                className="flex items-start gap-2 border-r border-gray-200 p-4"
                style={{
                  backgroundColor: idx % 2 === 0 ? "#fafafa" : "#f5f5f5",
                }}
              >
                <span className="shrink-0 text-base">{issue.icon}</span>
                <span className="text-xs font-bold uppercase leading-tight tracking-wide text-gray-500">
                  {issue.label}
                </span>
              </div>
              {candidates.map((c) => (
                <div
                  key={c.id}
                  className="border-r border-gray-100 last:border-r-0"
                >
                  <IssueCell issueData={getIssue(c, issue.key)} />
                </div>
              ))}
            </div>
          ))}

          {/* Sources */}
          <div
            className="grid border-t-2 border-gray-200 bg-gray-50"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="flex items-center border-r border-gray-200 p-4">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Sources
              </span>
            </div>
            {candidates.map((c) => (
              <SourceLinksCell key={c.id} candidate={c} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 bg-[#fafafa] px-4 py-3">
        <span className="text-xs text-gray-400">
          {candidates.length} candidates compared
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: "#C8922A" }}>
          AI-extracted · verify with original sources
        </span>
      </div>
    </div>
  );
}
