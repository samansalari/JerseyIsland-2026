"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ExpandedState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface IssueData {
  position: string;
  sourceQuote: string | null;
  confidence: number;
  issueName: string;
  issueDisplayName: string;
}

interface CandidateRow {
  id: string;
  name: string;
  slug: string;
  district: string;
  party: string | null;
  bio: string | null;
  ai_summary: string | null;
  manifesto_url: string | null;
  issueCount: number;
  issues: Record<string, IssueData>;
}

interface DistrictTableProps {
  initialDistrict: string;
  allDistricts: string[];
}

const ISSUE_NAMES = [
  "housing",
  "healthcare",
  "tax",
  "education",
  "environment",
  "transport",
  "cost_of_living",
  "immigration",
  "economy",
  "public_services",
] as const;

const ISSUE_LABELS: Record<string, string> = {
  housing: "Housing",
  healthcare: "Healthcare",
  tax: "Tax",
  education: "Education",
  environment: "Environment",
  transport: "Transport",
  cost_of_living: "Cost of Living",
  immigration: "Immigration",
  economy: "Economy",
  public_services: "Public Services",
};

const ISSUE_ICONS: Record<string, string> = {
  housing: "🏠",
  healthcare: "🏥",
  tax: "💰",
  education: "📚",
  environment: "🌿",
  transport: "🚌",
  cost_of_living: "🛒",
  immigration: "🌍",
  economy: "📈",
  public_services: "🏛️",
};

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color =
    confidence > 0.8
      ? "bg-green-500"
      : confidence > 0.5
        ? "bg-amber-400"
        : "bg-red-400";
  const label = confidence > 0.8 ? "High" : confidence > 0.5 ? "Med" : "Low";

  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${color}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </span>
  );
}

interface CellModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateRow | null;
  issue: string | null;
  issueData: IssueData | null;
}

function CellModal({
  isOpen,
  onClose,
  candidate,
  issue,
  issueData,
}: CellModalProps) {
  if (!isOpen || !candidate || !issue || !issueData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[#0D1B2A]/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-lg">{ISSUE_ICONS[issue]}</span>
              <span className="text-xs font-bold uppercase tracking-wide text-[#A31621]">
                {ISSUE_LABELS[issue] || issue}
              </span>
            </div>
            <Link
              href={`/candidates/${candidate.slug}`}
              className="text-lg font-bold text-[#0D1B2A] transition-colors hover:text-[#A31621]"
            >
              {candidate.name} ↗
            </Link>
            <div className="text-xs text-gray-400">{candidate.district}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-xl leading-none text-gray-400 transition-colors hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <ConfidenceDot confidence={issueData.confidence} />
          <span className="text-xs text-gray-400">
            confidence: {Math.round(issueData.confidence * 100)}%
          </span>
        </div>

        <div className="mb-4 rounded-xl bg-gray-50 p-4">
          <p className="text-sm leading-relaxed text-gray-800">{issueData.position}</p>
        </div>

        {issueData.sourceQuote && (
          <blockquote className="mb-4 border-l-4 border-[#C8922A] pl-4">
            <p className="text-sm italic text-gray-500">"{issueData.sourceQuote}"</p>
            <footer className="mt-1 text-xs text-gray-400">- from manifesto</footer>
          </blockquote>
        )}

        <div className="flex gap-3 border-t border-gray-100 pt-2">
          <Link
            href={`/candidates/${candidate.slug}`}
            className="flex-1 rounded-lg bg-[#0D1B2A] px-4 py-2 text-center text-sm font-medium text-[#F5E8C8] transition-colors hover:bg-[#1a2f47]"
          >
            View full profile
          </Link>
          {candidate.manifesto_url && (
            <a
              href={candidate.manifesto_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:border-[#A31621] hover:text-[#A31621]"
            >
              Original source ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpandedRow({ candidate }: { candidate: CandidateRow }) {
  return (
    <div className="border-t border-amber-100 bg-amber-50/60 px-6 py-5">
      <div className="max-w-3xl">
        {candidate.ai_summary ? (
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-amber-500">⚠</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                AI Summary
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-700">{candidate.ai_summary}</p>
          </div>
        ) : (
          <p className="mb-4 text-sm italic text-gray-400">No AI summary available yet.</p>
        )}

        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Issues covered: {candidate.issueCount}/{ISSUE_NAMES.length}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#A31621]"
              style={{ width: `${(candidate.issueCount / ISSUE_NAMES.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/candidates/${candidate.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#A31621] hover:underline"
          >
            View full candidate profile →
          </Link>
          {candidate.manifesto_url && (
            <a
              href={candidate.manifesto_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-[#A31621] hover:underline"
            >
              Original manifesto ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function DistrictTable({ initialDistrict, allDistricts }: DistrictTableProps) {
  const router = useRouter();
  const [district, setDistrict] = useState(initialDistrict);
  const [data, setData] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    issueCount: false,
  });
  const [issueFilter, setIssueFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCandidate, setModalCandidate] = useState<CandidateRow | null>(null);
  const [modalIssue, setModalIssue] = useState<string | null>(null);
  const [modalIssueData, setModalIssueData] = useState<IssueData | null>(null);

  const fetchDistrict = useCallback(async (nextDistrict: string) => {
    setLoading(true);
    setError(null);
    setExpanded({});
    try {
      const response = await fetch(`/api/districts/${encodeURIComponent(nextDistrict)}`);
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const json = (await response.json()) as { candidates?: CandidateRow[] };
      setData(json.candidates || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDistrict(district);
  }, [district, fetchDistrict]);

  function openCellModal(candidate: CandidateRow, issue: string) {
    const issueData = candidate.issues[issue];
    if (!issueData) return;
    setModalCandidate(candidate);
    setModalIssue(issue);
    setModalIssueData(issueData);
    setModalOpen(true);
  }

  const columnHelper = createColumnHelper<CandidateRow>();

  const columns = useMemo<ColumnDef<CandidateRow, any>[]>(
    () => [
      columnHelper.display({
        id: "expand",
        header: "",
        cell: ({ row }) => (
          <button
            onClick={() => row.toggleExpanded()}
            className="min-h-10 min-w-10 p-1 text-gray-400 transition-colors hover:text-[#A31621]"
            aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
          >
            <svg
              className={`h-4 w-4 transition-transform ${row.getIsExpanded() ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ),
        size: 40,
      }),
      columnHelper.accessor("name", {
        id: "candidate",
        header: "Candidate",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#A31621] text-xs font-bold text-[#F5E8C8]">
              {row.original.name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div className="min-w-0">
              <Link
                href={`/candidates/${row.original.slug}`}
                className="block truncate text-sm font-semibold text-[#0D1B2A] transition-colors hover:text-[#A31621]"
              >
                {row.original.name}
              </Link>
              <div className="truncate text-xs text-gray-400">
                {row.original.party || "Independent"} ·{" "}
                <span
                  className={`font-medium ${
                    row.original.issueCount >= 7
                      ? "text-green-600"
                      : row.original.issueCount >= 4
                        ? "text-amber-600"
                        : "text-red-500"
                  }`}
                >
                  {row.original.issueCount} issues
                </span>
              </div>
            </div>
          </div>
        ),
        size: 220,
        enableSorting: true,
      }),
      columnHelper.accessor("issueCount", {
        id: "issueCount",
        header: "Coverage",
        cell: ({ getValue }) => getValue(),
        size: 90,
      }),
      ...ISSUE_NAMES.map((issue) =>
        columnHelper.accessor((row) => row.issues[issue], {
          id: issue,
          header: () => (
            <div className="text-center">
              <div className="mb-0.5 text-base">{ISSUE_ICONS[issue]}</div>
              <div className="text-xs font-semibold leading-tight text-gray-600">
                {ISSUE_LABELS[issue]}
              </div>
            </div>
          ),
          cell: ({ row, getValue }) => {
            const issueData = getValue() as IssueData | undefined;
            if (!issueData) {
              return (
                <div className="flex h-full items-center justify-center">
                  <span className="text-lg text-gray-200">—</span>
                </div>
              );
            }

            return (
              <button
                onClick={() => openCellModal(row.original, issue)}
                className="group h-full w-full rounded-lg p-2 text-left transition-colors hover:bg-[#A31621]/5 active:scale-[0.96]"
              >
                <ConfidenceDot confidence={issueData.confidence} />
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-600 group-hover:text-[#0D1B2A]">
                  {issueData.position}
                </p>
                <span className="mt-1 block text-xs text-[#C8922A] opacity-0 transition-opacity group-hover:opacity-100">
                  Click to expand →
                </span>
              </button>
            );
          },
          enableSorting: false,
          size: 160,
        }),
      ),
    ],
    [],
  );

  const filteredData = useMemo(
    () =>
      data.filter((candidate) =>
        candidate.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [data, searchQuery],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, expanded, columnVisibility },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  useEffect(() => {
    const visibility: VisibilityState = { issueCount: false };
    ISSUE_NAMES.forEach((issue) => {
      visibility[issue] = issueFilter === "all" ? true : issue === issueFilter;
    });
    setColumnVisibility(visibility);
  }, [issueFilter]);

  return (
    <>
      <CellModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        candidate={modalCandidate}
        issue={modalIssue}
        issueData={modalIssueData}
      />

      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/districts" className="transition-colors hover:text-[#A31621]">
              ← All districts
            </Link>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#0D1B2A]">{district}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {data.length} candidates · Click any cell for full details · Click a row
                to expand
              </p>
            </div>
            <select
              value={district}
              onChange={(event) => {
                const nextDistrict = event.target.value;
                setDistrict(nextDistrict);
                router.push(`/districts/${encodeURIComponent(nextDistrict)}`, {
                  scroll: false,
                });
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#0D1B2A] focus:outline-none focus:ring-2 focus:ring-[#A31621]/30"
            >
              {allDistricts.map((districtName) => (
                <option key={districtName} value={districtName}>
                  {districtName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="relative min-w-[180px] flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#A31621]/30"
            />
          </div>

          <select
            value={issueFilter}
            onChange={(event) => setIssueFilter(event.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#0D1B2A] focus:outline-none focus:ring-2 focus:ring-[#A31621]/30"
          >
            <option value="all">All issues</option>
            {ISSUE_NAMES.map((issue) => (
              <option key={issue} value={issue}>
                {ISSUE_ICONS[issue]} {ISSUE_LABELS[issue]}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSorting([{ id: "candidate", desc: false }])}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-[#A31621] hover:text-[#A31621] active:scale-[0.96]"
          >
            A-Z
          </button>
          <button
            onClick={() => setSorting([{ id: "candidate", desc: true }])}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-[#A31621] hover:text-[#A31621] active:scale-[0.96]"
          >
            Z-A
          </button>
          <button
            onClick={() => setSorting([{ id: "issueCount", desc: true }])}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-[#A31621] hover:text-[#A31621] active:scale-[0.96]"
          >
            Most coverage
          </button>

          <div className="ml-auto flex items-center gap-4 text-xs text-gray-400 [font-variant-numeric:tabular-nums]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              High confidence
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
              Low
            </span>
            <span className="text-gray-200">—</span>
            <span>No data</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-[#A31621]" />
            <p className="text-sm">Loading {district} candidates...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={() => fetchDistrict(district)}
              className="mt-3 text-sm text-[#A31621] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-sm">No candidates found for {district}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:block">
              <div className="overflow-auto">
                <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b-2 border-gray-200 bg-gray-50">
                        {headerGroup.headers
                          .filter((header) => header.column.id !== "issueCount")
                          .map((header, index) => (
                            <th
                              key={header.id}
                              className={`top-0 px-3 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                                index <= 1 ? "sticky z-20 bg-gray-50" : "sticky z-10 bg-gray-50"
                              } ${index === 0 ? "left-0 w-10" : ""} ${
                                index === 1
                                  ? "left-10 border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.04)]"
                                  : ""
                              }`}
                              style={{ width: header.getSize() }}
                              onClick={
                                header.column.getCanSort()
                                  ? header.column.getToggleSortingHandler()
                                  : undefined
                              }
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getIsSorted() === "asc" && " ↑"}
                              {header.column.getIsSorted() === "desc" && " ↓"}
                            </th>
                          ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row, rowIndex) => (
                      <Fragment key={row.id}>
                        <tr
                          className={`border-b border-gray-100 transition-colors hover:bg-[#A31621]/3 ${
                            row.getIsExpanded()
                              ? "bg-amber-50/40"
                              : rowIndex % 2 === 0
                                ? "bg-white"
                                : "bg-gray-50/30"
                          }`}
                        >
                          {row
                            .getVisibleCells()
                            .filter((cell) => cell.column.id !== "issueCount")
                            .map((cell, cellIndex) => (
                              <td
                                key={cell.id}
                                className={`px-3 py-3 align-top ${
                                  cellIndex <= 1 ? "sticky z-10" : ""
                                } ${cellIndex === 0 ? "left-0 w-10" : ""} ${
                                  cellIndex === 1
                                    ? `left-10 border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.04)] ${
                                        row.getIsExpanded()
                                          ? "bg-amber-50/40"
                                          : rowIndex % 2 === 0
                                            ? "bg-white"
                                            : "bg-gray-50/30"
                                      }`
                                    : ""
                                }`}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                        </tr>
                        {row.getIsExpanded() && (
                          <tr>
                            <td colSpan={row.getVisibleCells().filter((cell) => cell.column.id !== "issueCount").length} className="p-0">
                              <ExpandedRow candidate={row.original} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                <span className="text-xs text-gray-400 [font-variant-numeric:tabular-nums]">
                  {table.getRowModel().rows.length} of {data.length} candidates
                  {searchQuery && ` matching "${searchQuery}"`}
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <span>⚠</span> AI-extracted positions - verify with original sources
                </span>
              </div>
            </div>

            <div className="space-y-4 lg:hidden">
              {table.getRowModel().rows.map((row) => (
                <div key={row.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-start gap-3 p-4">
                    <button
                      onClick={() => row.toggleExpanded()}
                      className="mt-0.5 min-h-10 min-w-10 p-1 text-gray-400 transition-colors hover:text-[#A31621]"
                    >
                      <svg
                        className={`h-4 w-4 transition-transform ${row.getIsExpanded() ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#A31621] text-xs font-bold text-[#F5E8C8]">
                          {row.original.name
                            .split(" ")
                            .map((word) => word[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/candidates/${row.original.slug}`}
                            className="block truncate text-sm font-semibold text-[#0D1B2A]"
                          >
                            {row.original.name}
                          </Link>
                          <div className="text-xs text-gray-400">
                            {row.original.party || "Independent"} · {row.original.issueCount} issues
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {row.getIsExpanded() && <ExpandedRow candidate={row.original} />}

                  <div className="grid grid-cols-1 gap-2 border-t border-gray-100 p-4">
                    {ISSUE_NAMES.filter((issue) =>
                      issueFilter === "all" ? true : issue === issueFilter,
                    ).map((issue) => {
                      const issueData = row.original.issues[issue];
                      return (
                        <button
                          key={issue}
                          onClick={() => issueData && openCellModal(row.original, issue)}
                          className={`rounded-xl border p-3 text-left ${
                            issueData
                              ? "border-gray-200 bg-gray-50 transition-colors hover:border-[#A31621] hover:bg-[#A31621]/5"
                              : "border-gray-100 bg-white"
                          }`}
                          disabled={!issueData}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span>{ISSUE_ICONS[issue]}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              {ISSUE_LABELS[issue]}
                            </span>
                          </div>
                          {issueData ? (
                            <>
                              <ConfidenceDot confidence={issueData.confidence} />
                              <p className="mt-1 text-xs leading-snug text-gray-600">
                                {issueData.position}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs italic text-gray-300">No data</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
