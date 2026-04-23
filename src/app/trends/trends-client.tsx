"use client";

import Link from "next/link";
import type { CandidateSentiment, OverallSentiment } from "./page";

/**
 * Client component for the sentiment overview.
 * Uses pure CSS for charts — no Recharts dependency needed for this
 * minimal display. Keeps the bundle lean.
 */

export function TrendsClient({
  overall,
  candidates,
  totalArticles,
}: {
  overall: OverallSentiment;
  candidates: CandidateSentiment[];
  totalArticles: number;
}) {
  return (
    <div className="mt-8">
      {/* Disclaimers — prominent, not hidden */}
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
        <div className="flex gap-3">
          <svg
            viewBox="0 0 20 20"
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6Zm0 9a1 1 0 100-2 1 1 0 000 2Z"
              clipRule="evenodd"
            />
          </svg>
          <div className="space-y-1.5 text-[13px] leading-relaxed text-navy/80">
            <p>
              <strong className="font-semibold">
                Sentiment is AI-estimated from media coverage only.
              </strong>{" "}
              It reflects how news outlets write about candidates, not public
              opinion.
            </p>
            <p>
              <strong className="font-semibold">
                Small sample sizes may not be representative.
              </strong>{" "}
              Candidates with fewer articles have less reliable readings.
            </p>
            <p>
              <strong className="font-semibold">
                This is not a poll or prediction.
              </strong>{" "}
              It is a transparency tool showing how media coverage is
              distributed.
            </p>
          </div>
        </div>
      </div>

      {/* Overall sentiment donut */}
      <section className="mt-8 rounded-xl border border-border bg-white p-6">
        <h2 className="text-[16px] font-bold text-navy">
          Overall media sentiment
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Based on {totalArticles} articles with AI sentiment analysis
        </p>

        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
          {/* Donut */}
          <DonutChart
            positive={overall.positive}
            neutral={overall.neutral}
            negative={overall.negative}
          />

          {/* Legend */}
          <div className="flex flex-col gap-3">
            <LegendRow
              color="var(--chart-sentiment-positive)"
              label="Positive"
              count={overall.positive}
              total={overall.total}
            />
            <LegendRow
              color="var(--chart-sentiment-neutral)"
              label="Neutral"
              count={overall.neutral}
              total={overall.total}
            />
            <LegendRow
              color="var(--chart-sentiment-negative)"
              label="Negative"
              count={overall.negative}
              total={overall.total}
            />
          </div>
        </div>
      </section>

      {/* Per-candidate bars */}
      <section className="mt-8">
        <h2 className="text-[16px] font-bold text-navy">
          Sentiment by candidate
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Only candidates with 3+ articles shown
        </p>

        {candidates.length === 0 ? (
          <p className="mt-6 text-[13px] italic text-muted-foreground">
            No candidates have 3+ articles yet. Check back as coverage grows.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {candidates.map((c) => (
              <CandidateBar key={c.slug} candidate={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Donut chart (pure SVG) ──────────────────────────────────────────────────

function DonutChart({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  const total = positive + neutral + negative;
  if (total === 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const pPos = positive / total;
  const pNeu = neutral / total;
  const pNeg = negative / total;

  const segments = [
    { pct: pPos, color: "var(--chart-sentiment-positive)", offset: 0 },
    { pct: pNeu, color: "var(--chart-sentiment-neutral)", offset: pPos },
    { pct: pNeg, color: "var(--chart-sentiment-negative)", offset: pPos + pNeu },
  ];

  return (
    <div className="relative flex-shrink-0">
      <svg width="120" height="120" viewBox="0 0 100 100">
        {segments.map((seg, i) =>
          seg.pct > 0 ? (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={`${seg.pct * circumference} ${circumference}`}
              strokeDashoffset={-seg.offset * circumference}
              transform="rotate(-90 50 50)"
              strokeLinecap="butt"
            />
          ) : null,
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-bold tabular-nums text-navy">
          {total}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          articles
        </span>
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  count,
  total,
}: {
  color: string;
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span
        className="h-3 w-3 flex-shrink-0 rounded-sm"
        style={{ background: color }}
      />
      <span className="w-16 font-medium text-navy">{label}</span>
      <span className="tabular-nums text-muted-foreground">
        {count} ({pct}%)
      </span>
    </div>
  );
}

// ── Candidate sentiment bar ─────────────────────────────────────────────────

function CandidateBar({ candidate: c }: { candidate: CandidateSentiment }) {
  const total = c.positive + c.neutral + c.negative;
  const pPos = total > 0 ? (c.positive / total) * 100 : 0;
  const pNeu = total > 0 ? (c.neutral / total) * 100 : 0;
  const pNeg = total > 0 ? (c.negative / total) * 100 : 0;

  return (
    <Link
      href={`/candidates/${c.slug}`}
      className="group block rounded-xl border border-border bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-navy transition-colors group-hover:text-jersey-red">
            {c.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {c.district}
            {c.party ? ` · ${c.party}` : " · Independent"}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-[18px] font-bold tabular-nums text-navy">
            {c.articleCount}
          </p>
          <p className="text-[10px] text-muted-foreground">articles</p>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted">
        {pPos > 0 && (
          <div
            className="h-full bg-[color:var(--chart-sentiment-positive)] transition-all"
            style={{ width: `${pPos}%` }}
            title={`Positive: ${c.positive}`}
          />
        )}
        {pNeu > 0 && (
          <div
            className="h-full bg-[color:var(--chart-sentiment-neutral)] transition-all"
            style={{ width: `${pNeu}%` }}
            title={`Neutral: ${c.neutral}`}
          />
        )}
        {pNeg > 0 && (
          <div
            className="h-full bg-[color:var(--chart-sentiment-negative)] transition-all"
            style={{ width: `${pNeg}%` }}
            title={`Negative: ${c.negative}`}
          />
        )}
      </div>

      {/* Labels */}
      <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {c.positive}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          {c.neutral}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-jersey-red" />
          {c.negative}
        </span>
      </div>
    </Link>
  );
}
