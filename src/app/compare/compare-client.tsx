"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";

// ── Types ───────────────────────────────────────────────────────────────────

type CandidateOption = {
  slug: string;
  name: string;
  district: string;
  party: string | null;
  photoUrl: string | null;
};

type IssueRow = {
  id: string;
  name: string;
  displayName: string;
  icon: string | null;
};

type Position = {
  candidateId: string;
  issueId: string;
  position: string;
  sourceQuote: string;
  confidence: number;
};

type CompareData = {
  candidates: (CandidateOption & { id: string })[];
  issues: IssueRow[];
  positions: Position[];
};

// ── Component ───────────────────────────────────────────────────────────────

export function CompareClient({
  allCandidates,
  allIssues,
  districts,
}: {
  allCandidates: CandidateOption[];
  allIssues: IssueRow[];
  districts: string[];
}) {
  const [selected, setSelected] = useState<string[]>([]); // slugs
  const [districtFilter, setDistrictFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Read initial selection from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("candidates");
    if (c) {
      const slugs = c.split(",").filter(Boolean);
      const valid = slugs.filter((s) =>
        allCandidates.some((ac) => ac.slug === s),
      );
      if (valid.length >= 2) setSelected(valid.slice(0, 4));
    }
  }, [allCandidates]);

  // Fetch comparison data when selection changes
  useEffect(() => {
    if (selected.length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/compare?candidates=${selected.join(",")}`)
      .then((r) => r.json())
      .then((d: CompareData) => {
        setData(d);
        // Update URL
        const url = new URL(window.location.href);
        url.searchParams.set("candidates", selected.join(","));
        window.history.replaceState({}, "", url.toString());
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selected]);

  const toggleCandidate = useCallback(
    (slug: string) => {
      setSelected((prev) => {
        if (prev.includes(slug)) return prev.filter((s) => s !== slug);
        if (prev.length >= 4) return prev;
        return [...prev, slug];
      });
    },
    [],
  );

  const removeCandidate = useCallback((slug: string) => {
    setSelected((prev) => prev.filter((s) => s !== slug));
  }, []);

  const filteredOptions = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allCandidates.filter((c) => {
      if (selected.includes(c.slug)) return false;
      if (districtFilter && c.district !== districtFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allCandidates, selected, districtFilter, search]);

  const toggleQuote = (key: string) => {
    setExpandedQuotes((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const shareUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("candidates", selected.join(","));
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Build lookup: candidateId+issueId → position
  const posMap = useMemo(() => {
    if (!data) return new Map<string, Position>();
    const m = new Map<string, Position>();
    for (const p of data.positions) {
      m.set(`${p.candidateId}:${p.issueId}`, p);
    }
    return m;
  }, [data]);

  const selectedCandidates = allCandidates.filter((c) =>
    selected.includes(c.slug),
  );

  return (
    <div className="mt-8">
      {/* ── Selector ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-[13px] text-navy outline-none transition-colors focus:border-jersey-red/40 focus:ring-1 focus:ring-jersey-red/20"
          >
            <option value="">All districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <div className="relative flex-1">
            <svg
              viewBox="0 0 20 20"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5 18 18" />
            </svg>
            <input
              type="text"
              placeholder="Search candidates to add…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => setDropdownOpen(true)}
              className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-[13px] text-navy outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-jersey-red/40 focus:ring-1 focus:ring-jersey-red/20"
            />

            {/* Dropdown */}
            {dropdownOpen && filteredOptions.length > 0 && (
              <div className="absolute left-0 top-12 z-30 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                {filteredOptions.slice(0, 20).map((c) => {
                  const initials = c.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      disabled={selected.length >= 4}
                      onClick={() => {
                        toggleCandidate(c.slug);
                        setSearch("");
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-surface disabled:opacity-40"
                    >
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-jersey-red text-[10px] font-bold text-on-primary">
                        {initials}
                      </span>
                      <span className="flex-1 font-medium text-navy">
                        {c.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.district}
                      </span>
                    </button>
                  );
                })}
                {selected.length >= 4 && (
                  <p className="px-4 py-2 text-[12px] text-muted-foreground">
                    Maximum 4 candidates selected
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected chips */}
        {selectedCandidates.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedCandidates.map((c) => (
              <span
                key={c.slug}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface pl-3 pr-1.5 py-1 text-[13px] font-medium text-navy"
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => removeCandidate(c.slug)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-jersey-red/10 hover:text-jersey-red"
                  aria-label={`Remove ${c.name}`}
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </span>
            ))}
            {selected.length >= 2 && (
              <button
                type="button"
                onClick={shareUrl}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:border-jersey-red/30 hover:text-jersey-red"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 10l4-4M9 4.5h2.5V7" />
                  <rect x="2" y="6" width="7" height="7" rx="1.5" />
                </svg>
                {copied ? "Copied!" : "Share comparison"}
              </button>
            )}
          </div>
        )}

        {selected.length < 2 && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            Select at least 2 candidates to compare.
            {selected.length === 1 && " Add 1 more."}
          </p>
        )}
      </div>

      {/* ── Loading ──────────────────────────────────── */}
      {loading && (
        <div className="mt-10 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-jersey-red" />
        </div>
      )}

      {/* ── Comparison matrix ────────────────────────── */}
      {data && !loading && (
        <>
          {/* Desktop table */}
          <div className="mt-8 hidden md:block">
            <div className="overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="sticky left-0 z-10 bg-surface px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Issue
                    </th>
                    {data.candidates.map((c) => (
                      <th
                        key={c.id}
                        className="min-w-[200px] border-l border-border px-5 py-4 text-left"
                      >
                        <Link
                          href={`/candidates/${c.slug}`}
                          className="font-semibold text-navy transition-colors hover:text-jersey-red"
                        >
                          {c.name}
                        </Link>
                        <div className="mt-0.5 text-[11px] font-normal text-muted-foreground">
                          {c.district}
                          {c.party ? ` · ${c.party}` : " · Independent"}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allIssues.map((issue, idx) => (
                    <tr
                      key={issue.id}
                      className={
                        idx % 2 === 0 ? "bg-white" : "bg-surface/40"
                      }
                    >
                      <td
                        className={`sticky left-0 z-10 border-t border-border px-5 py-4 font-medium text-navy ${
                          idx % 2 === 0 ? "bg-white" : "bg-surface/40"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {issue.icon && (
                            <span className="text-[14px]">{issue.icon}</span>
                          )}
                          {issue.displayName}
                        </span>
                      </td>
                      {data.candidates.map((c) => {
                        const pos = posMap.get(`${c.id}:${issue.id}`);
                        const quoteKey = `${c.id}:${issue.id}`;
                        return (
                          <td
                            key={c.id}
                            className="border-l border-t border-border px-5 py-4 align-top"
                          >
                            {pos ? (
                              <>
                                <ConfidenceDot value={pos.confidence} />
                                <p className="mt-1 leading-relaxed text-navy">
                                  {pos.position}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => toggleQuote(quoteKey)}
                                  className="mt-2 text-[11px] font-medium text-gold transition-colors hover:text-jersey-red"
                                >
                                  {expandedQuotes.has(quoteKey)
                                    ? "Hide source"
                                    : "View source"}
                                </button>
                                {expandedQuotes.has(quoteKey) && (
                                  <div className="mt-2 rounded-md border-l-2 border-jersey-red/30 bg-surface py-2 pl-3 pr-2">
                                    <p className="text-[11px] italic leading-relaxed text-muted-foreground">
                                      &ldquo;{pos.sourceQuote}&rdquo;
                                    </p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-[12px] italic text-muted-foreground/50">
                                No data
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="mt-8 space-y-4 md:hidden">
            {allIssues.map((issue) => {
              const hasAny = data.candidates.some((c) =>
                posMap.has(`${c.id}:${issue.id}`),
              );
              return (
                <div
                  key={issue.id}
                  className="rounded-xl border border-border bg-white p-5"
                >
                  <h3 className="flex items-center gap-2 text-[15px] font-semibold text-navy">
                    {issue.icon && (
                      <span className="text-[16px]">{issue.icon}</span>
                    )}
                    {issue.displayName}
                  </h3>
                  {!hasAny ? (
                    <p className="mt-3 text-[12px] italic text-muted-foreground/50">
                      No candidate has data on this issue yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {data.candidates.map((c) => {
                        const pos = posMap.get(`${c.id}:${issue.id}`);
                        const quoteKey = `m:${c.id}:${issue.id}`;
                        return (
                          <div
                            key={c.id}
                            className="rounded-lg border border-border bg-surface p-3"
                          >
                            <div className="flex items-center justify-between">
                              <Link
                                href={`/candidates/${c.slug}`}
                                className="text-[13px] font-semibold text-navy hover:text-jersey-red"
                              >
                                {c.name}
                              </Link>
                              {pos && (
                                <ConfidenceBadge value={pos.confidence} />
                              )}
                            </div>
                            {pos ? (
                              <>
                                <p className="mt-1.5 text-[12px] leading-relaxed text-navy">
                                  {pos.position}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => toggleQuote(quoteKey)}
                                  className="mt-2 text-[11px] font-medium text-gold hover:text-jersey-red"
                                >
                                  {expandedQuotes.has(quoteKey)
                                    ? "Hide source"
                                    : "View source"}
                                </button>
                                {expandedQuotes.has(quoteKey) && (
                                  <div className="mt-2 rounded-md border-l-2 border-jersey-red/30 bg-white py-2 pl-3 pr-2">
                                    <p className="text-[11px] italic leading-relaxed text-muted-foreground">
                                      &ldquo;{pos.sourceQuote}&rdquo;
                                    </p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="mt-1 text-[12px] italic text-muted-foreground/50">
                                No data
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Close dropdown on outside click ──────────── */}
      {dropdownOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setDropdownOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function ConfidenceDot({ value }: { value: number }) {
  const color =
    value >= 0.8 ? "bg-success" : value >= 0.5 ? "bg-gold" : "bg-jersey-red";
  const label =
    value >= 0.8 ? "High" : value >= 0.5 ? "Medium" : "Low";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
      title={`${label} confidence (${Math.round(value * 100)}%)`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const level = value >= 0.8 ? "High" : value >= 0.5 ? "Med" : "Low";
  const cls =
    value >= 0.8
      ? "border-success/30 bg-success/10 text-success"
      : value >= 0.5
        ? "border-gold/30 bg-gold/10 text-gold"
        : "border-jersey-red/30 bg-jersey-red/10 text-jersey-red";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {level}
    </span>
  );
}
