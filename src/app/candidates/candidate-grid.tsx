"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CandidateCard } from "./page";
import { safeDisplayName } from "@/lib/candidate-utils";

export function CandidateGrid({
  candidates,
  districts,
  parties,
}: {
  candidates: CandidateCard[];
  districts: string[];
  parties: string[];
}) {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("");
  const [party, setParty] = useState(""); // "" = all, "__independent" = null party

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return candidates.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (district && c.district !== district) return false;
      if (party === "__independent" && c.party !== null) return false;
      if (party && party !== "__independent" && c.party !== party) return false;
      return true;
    });
  }, [candidates, search, district, party]);

  const hasActiveFilter = search || district || party;

  return (
    <>
      {/* ── Filter bar ─────────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
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
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-[13px] text-navy outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-jersey-red/40 focus:ring-1 focus:ring-jersey-red/20"
          />
        </div>

        {/* District */}
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 text-[13px] text-navy outline-none transition-colors focus:border-jersey-red/40 focus:ring-1 focus:ring-jersey-red/20"
        >
          <option value="">All districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Party */}
        <select
          value={party}
          onChange={(e) => setParty(e.target.value)}
          className="h-10 rounded-md border border-border bg-white px-3 text-[13px] text-navy outline-none transition-colors focus:border-jersey-red/40 focus:ring-1 focus:ring-jersey-red/20"
        >
          <option value="">All parties</option>
          <option value="__independent">Independent</option>
          {parties.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Clear */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setDistrict("");
              setParty("");
            }}
            className="h-10 rounded-md border border-border bg-white px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-jersey-red/30 hover:text-jersey-red"
          >
            Clear
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="mt-4 text-[12px] font-medium text-muted-foreground">
        {filtered.length} candidate{filtered.length !== 1 && "s"}
        {hasActiveFilter && " matching filters"}
      </p>

      {/* ── Grid / Empty state ─────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-muted-foreground/50"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M16 16 21 21" />
              <path d="M8 11h6" />
            </svg>
          </div>
          <p className="mt-4 text-[15px] font-semibold text-navy">
            No candidates found
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try adjusting your filters or search term.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CandidateCardItem key={c.slug} candidate={c} />
          ))}
        </div>
      )}
    </>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function CandidateCardItem({ candidate: c }: { candidate: CandidateCard }) {
  const displayName = safeDisplayName(c.name);
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const summary = c.aiSummary
    ? c.aiSummary.length > 120
      ? c.aiSummary.slice(0, 120).replace(/\s+\S*$/, "") + "…"
      : c.aiSummary
    : null;

  return (
    <Link
      href={`/candidates/${c.slug}`}
      className="group flex gap-4 rounded-xl border border-border bg-white p-4 transition-all hover:border-border hover:shadow-card-hover"
    >
      {/* Avatar */}
      {c.photoUrl ? (
        <img
          src={c.photoUrl}
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-jersey-red text-[14px] font-bold text-on-primary">
          {initials}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* Name */}
        <p className="text-[15px] font-semibold text-navy group-hover:text-jersey-red transition-colors">
          {displayName}
        </p>

        {/* District + Party */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
          <span>{c.district}</span>
          <span className="text-border">·</span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              c.party
                ? "border-border bg-muted/50 text-muted-foreground"
                : "border-gold/30 bg-gold/10 text-gold"
            }`}
          >
            {c.party ?? "Independent"}
          </span>
        </div>

        {/* Summary */}
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          {summary ? (
            <>
              {summary}{" "}
              <span className="font-medium text-gold group-hover:text-jersey-red transition-colors">
                Read more&thinsp;→
              </span>
            </>
          ) : (
            <span className="italic text-muted-foreground/60">
              Summary coming soon
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}
