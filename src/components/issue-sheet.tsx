"use client";

import { useState, useCallback } from "react";
import type { TopicData } from "./issue-intelligence";

interface CandidatePosition {
  name: string;
  slug: string;
  district: string;
  party: string | null;
  position: string;
  sourceQuote: string;
  confidence: number;
  manifestoUrl: string | null;
}

interface TopicSummaryData {
  aiSummary: string | null;
  sourcesCited:
    | {
        candidateName: string;
        slug: string;
        sourceQuote: string;
        manifestoUrl: string | null;
      }[]
    | null;
  topParties: { party: string; count: number }[] | null;
}

interface TopicApiResponse {
  issue: string;
  summary: TopicSummaryData | null;
  candidates: CandidatePosition[];
  total: number;
}

const FEEDBACK_TYPES = [
  {
    value: "accurate",
    label: "✓ Accurate",
    colour:
      "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
  },
  {
    value: "inaccurate",
    label: "✗ Inaccurate",
    colour: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
  },
  {
    value: "missing_data",
    label: "+ Missing data",
    colour:
      "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
  },
  {
    value: "wrong_attribution",
    label: "⚠ Wrong attribution",
    colour:
      "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
  },
] as const;

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence > 0.8)
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
        High
      </span>
    );
  if (confidence > 0.5)
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        Medium
      </span>
    );
  return (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
      Low
    </span>
  );
}

export function IssueSheet({ topic }: { topic: TopicData }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TopicApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(topic.upvoteCount);
  const [hasUpvoted, setHasUpvoted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`vp-upvote-${topic.issue}`) === "1";
  });
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState<string | null>(null);

  const openSheet = useCallback(async () => {
    setOpen(true);
    if (data) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/topics/${topic.issue}`);
      const json = (await res.json()) as TopicApiResponse;
      setData(json);
    } catch (err) {
      console.error("[IssueSheet] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [topic.issue, data]);

  const handleUpvote = async () => {
    if (hasUpvoted) return;
    try {
      const res = await fetch(`/api/topics/${topic.issue}/upvote`, {
        method: "POST",
      });
      const json = (await res.json()) as { ok: boolean; total: number };
      if (json.ok) {
        setUpvoteCount(json.total);
        setHasUpvoted(true);
        localStorage.setItem(`vp-upvote-${topic.issue}`, "1");
      }
    } catch {
      /* non-fatal */
    }
  };

  const handleFeedback = async () => {
    if (!feedbackType || feedbackSent || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    setFeedbackError(false);
    try {
      const res = await fetch(`/api/topics/${topic.issue}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackType, content: feedbackText || undefined }),
      });
      if (res.ok) {
        setFeedbackSent(true);
      } else {
        setFeedbackError(true);
      }
    } catch {
      setFeedbackError(true);
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <>
      {/* Topic tile — clickable card on the homepage */}
      <button
        onClick={openSheet}
        className="group flex w-full flex-col items-start gap-3 rounded-2xl border border-border bg-white p-4 text-left shadow-sm transition-all hover:border-gold/50 hover:shadow-md"
        aria-label={`Open ${topic.displayName} plans`}
      >
        {/* Icon row + candidate count badge */}
        <div className="flex w-full items-start justify-between">
          <span className="text-3xl">{topic.icon}</span>
          {topic.candidateCount > 0 && (
            <span className="flex-shrink-0 rounded-full bg-navy px-2 py-0.5 text-[11px] font-semibold text-[#F5E8C8]">
              {topic.candidateCount}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="text-[13px] font-bold text-navy transition-colors group-hover:text-jersey-red">
          {topic.displayName}
        </div>

        {/* Content: three states */}
        <div className="min-h-[52px] w-full">
          {topic.aiSummary ? (
            /* STATE A: Full AI summary available */
            <p className="line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
              {topic.aiSummary}
            </p>
          ) : topic.candidateCount > 0 ? (
            /* STATE B: No summary yet, but candidates have positions */
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-jersey-red">
                {topic.candidateCount} candidate
                {topic.candidateCount !== 1 ? "s" : ""} have positions
              </p>
              {topic.samplePosition && (
                <p className="mt-1 line-clamp-2 text-[11px] italic leading-relaxed text-muted-foreground">
                  &ldquo;
                  {topic.samplePosition.length > 90
                    ? topic.samplePosition.slice(0, 90) + "…"
                    : topic.samplePosition}
                  &rdquo;
                </p>
              )}
            </div>
          ) : (
            /* STATE C: Genuinely no data */
            <p className="text-[11px] italic text-muted-foreground/50">
              No candidate positions found yet
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto flex w-full items-center justify-between border-t border-border pt-2">
          <span className="text-[11px] text-muted-foreground">
            {upvoteCount > 0
              ? `${upvoteCount} interested`
              : topic.candidateCount > 0
                ? "Be first to upvote"
                : ""}
          </span>
          <span className="text-[12px] font-medium text-gold transition-transform group-hover:translate-x-0.5">
            {topic.candidateCount > 0 ? "See positions →" : "Explore →"}
          </span>
        </div>
      </button>

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Sheet panel — slides in from right */}
          <div className="relative ml-auto h-full w-full max-w-xl overflow-y-auto bg-surface shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between bg-navy px-6 py-5 text-on-primary">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{topic.icon}</span>
                <div>
                  <h2 className="text-[17px] font-bold leading-tight">
                    {topic.displayName}
                  </h2>
                  <p className="text-[12px] text-on-primary/50">
                    Jersey 2026 Election
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-xl font-light text-on-primary/60 hover:text-on-primary"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 px-6 py-6">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-jersey-red" />
                </div>
              ) : data ? (
                <>
                  {/* Amber banner: no AI summary yet, but candidate data exists */}
                  {!data.summary?.aiSummary && data.total > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-[13px] text-amber-700">
                        <strong>Full policy synthesis coming April 27.</strong>{" "}
                        Below are individual candidate positions extracted from
                        their current campaign materials.
                      </p>
                    </div>
                  )}

                  {/* AI Summary */}
                  {data.summary?.aiSummary && (
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <svg
                          viewBox="0 0 20 20"
                          className="h-4 w-4 flex-shrink-0 text-gold"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6Zm0 9a1 1 0 100-2 1 1 0 000 2Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-[11px] font-bold uppercase tracking-wide text-gold">
                          AI Summary
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          — verify with sources below
                        </span>
                      </div>
                      <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                        <p className="text-[13px] leading-relaxed text-navy">
                          {data.summary.aiSummary}
                        </p>
                      </div>
                    </section>
                  )}

                  {/* Stats row */}
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-xl border border-border bg-white p-3 text-center">
                      <div className="text-[22px] font-bold text-jersey-red">
                        {data.total}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        candidates
                      </div>
                    </div>
                    {data.summary?.topParties
                      ?.slice(0, 2)
                      .map((p) => (
                        <div
                          key={p.party}
                          className="flex-1 rounded-xl border border-border bg-white p-3 text-center"
                        >
                          <div className="text-[18px] font-bold text-navy">
                            {p.count}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {p.party}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Upvote */}
                  <div className="flex items-center justify-between rounded-xl border border-border bg-white p-4">
                    <div>
                      <p className="text-[13px] font-semibold text-navy">
                        Is this issue important to you?
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {upvoteCount > 0
                          ? `${upvoteCount} Jersey residents marked this as important`
                          : "Be the first to mark this as important"}
                      </p>
                    </div>
                    <button
                      onClick={handleUpvote}
                      disabled={hasUpvoted}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all ${
                        hasUpvoted
                          ? "cursor-default bg-emerald-600 text-white"
                          : "bg-navy text-on-primary hover:bg-jersey-red"
                      }`}
                    >
                      {hasUpvoted ? "✓ Noted" : "▲ Important"}
                    </button>
                  </div>

                  {/* Candidate positions */}
                  <section>
                    <h3 className="mb-3 text-[13px] font-bold text-navy">
                      Candidate positions ({data.total})
                    </h3>

                    {data.candidates.length === 0 ? (
                      <div className="py-8 text-center text-[13px] italic text-muted-foreground">
                        No candidate positions extracted yet for this topic.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.candidates.map((c) => (
                          <div
                            key={c.slug}
                            className="rounded-xl border border-border bg-white p-4"
                          >
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <div>
                                <a
                                  href={`/candidates/${c.slug}`}
                                  className="text-[13px] font-semibold text-navy transition-colors hover:text-jersey-red"
                                >
                                  {c.name}
                                </a>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="text-[11px] text-muted-foreground">
                                    {c.district}
                                  </span>
                                  {c.party && (
                                    <>
                                      <span className="text-border">·</span>
                                      <span className="text-[11px] font-medium text-jersey-red">
                                        {c.party}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ConfidenceBadge confidence={c.confidence} />
                            </div>

                            <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
                              {c.position}
                            </p>

                            {c.sourceQuote && (
                              <div className="border-l-2 border-gold pl-3">
                                <p className="text-[12px] italic leading-relaxed text-muted-foreground">
                                  &ldquo;{c.sourceQuote}&rdquo;
                                </p>
                                {c.manifestoUrl && (
                                  <a
                                    href={c.manifestoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-block text-[12px] text-jersey-red hover:underline"
                                  >
                                    Source ↗
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Anonymous feedback */}
                  <section className="rounded-xl border border-border bg-white p-5">
                    <h3 className="mb-1 text-[13px] font-bold text-navy">
                      Is this information accurate?
                    </h3>
                    <p className="mb-4 text-[12px] text-muted-foreground">
                      Anonymous feedback helps us improve. No account needed.
                    </p>

                    {feedbackSent ? (
                      <div className="flex items-center gap-2 py-2 text-[13px] text-emerald-600">
                        <span>✓</span>
                        <span>Thank you — feedback recorded anonymously.</span>
                      </div>
                    ) : (
                      <>
                        <div className="mb-4 flex flex-wrap gap-2">
                          {FEEDBACK_TYPES.map((f) => (
                            <button
                              key={f.value}
                              onClick={() =>
                                setFeedbackType(
                                  feedbackType === f.value ? null : f.value,
                                )
                              }
                              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all ${
                                feedbackType === f.value
                                  ? f.colour +
                                    " ring-2 ring-current ring-offset-1"
                                  : "border-border bg-surface text-muted-foreground hover:border-border/80"
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>

                        {feedbackType && (
                          <textarea
                            value={feedbackText}
                            onChange={(e) =>
                              setFeedbackText(e.target.value.slice(0, 500))
                            }
                            placeholder="Add details (optional, max 500 chars)"
                            rows={2}
                            className="mb-3 w-full resize-none rounded-lg border border-border px-3 py-2 text-[12px] text-navy placeholder-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold/30"
                          />
                        )}

                        {feedbackError && (
                          <p className="mb-2 text-[12px] text-jersey-red">
                            Something went wrong. Please try again.
                          </p>
                        )}

                        <button
                          onClick={handleFeedback}
                          disabled={!feedbackType || feedbackSubmitting}
                          className="rounded-lg bg-navy px-4 py-2 text-[12px] font-semibold text-on-primary transition-colors hover:bg-jersey-red disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          {feedbackSubmitting ? "Submitting…" : "Submit feedback"}
                        </button>
                      </>
                    )}
                  </section>

                  <p className="pb-2 text-center text-[12px] text-muted-foreground">
                    VotePulse is non-partisan. All data is sourced from public
                    manifesto pages.{" "}
                    <a
                      href="/about"
                      className="text-jersey-red hover:underline"
                    >
                      About our methodology
                    </a>
                  </p>
                </>
              ) : (
                <p className="py-20 text-center text-[13px] text-muted-foreground">
                  Could not load data. Please try again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
