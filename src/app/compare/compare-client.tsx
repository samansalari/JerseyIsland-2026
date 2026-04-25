"use client";

import { useMemo, useState } from "react";
import {
  ComparisonTable,
  type CandidateCompare,
} from "./comparison-table";

interface Candidate {
  id: string;
  name: string;
  slug: string;
  district: string;
  party: string | null;
  photo_url: string | null;
}

interface CompareClientProps {
  allCandidates: Candidate[];
  districts: string[];
}

export function CompareClient({
  allCandidates,
  districts,
}: CompareClientProps) {
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<CandidateCompare[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredCandidates = useMemo(() => {
    return allCandidates.filter((candidate) => {
      const matchesDistrict =
        selectedDistrict === "all" || candidate.district === selectedDistrict;
      const matchesSearch = candidate.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesDistrict && matchesSearch;
    });
  }, [allCandidates, searchQuery, selectedDistrict]);

  const selectedCandidates = useMemo(
    () => allCandidates.filter((candidate) => selectedIds.includes(candidate.id)),
    [allCandidates, selectedIds],
  );

  function toggleCandidate(id: string) {
    setSelectedIds((previous) => {
      if (previous.includes(id)) {
        return previous.filter((candidateId) => candidateId !== id);
      }
      if (previous.length >= 4) {
        return previous;
      }
      return [...previous, id];
    });
    setComparisonData([]);
  }

  async function loadComparison() {
    if (selectedIds.length < 2) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/compare?ids=${selectedIds.join(",")}`);
      if (!response.ok) {
        throw new Error(`Compare API returned ${response.status}`);
      }
      const payload = (await response.json()) as {
        candidates?: CandidateCompare[];
        error?: string;
      };
      if (payload.error) {
        throw new Error(payload.error);
      }
      setComparisonData(payload.candidates ?? []);
    } catch (error) {
      console.error(error);
      setComparisonData([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0D1B2A]">
            Compare Candidates
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Select 2-4 candidates to compare their positions on every issue
            side by side.
            <span className="ml-1 text-amber-600">
              Positions are AI-extracted from manifestos.
            </span>
          </p>
        </div>

        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap gap-3">
            <select
              value={selectedDistrict}
              onChange={(event) => setSelectedDistrict(event.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#0D1B2A] focus:border-[#A31621] focus:outline-none focus:ring-2 focus:ring-[#A31621]/30"
            >
              <option value="all">All districts</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>

            <div className="relative min-w-[200px] flex-1">
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
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm focus:border-[#A31621] focus:outline-none focus:ring-2 focus:ring-[#A31621]/30"
              />
            </div>
          </div>

          {selectedCandidates.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {selectedCandidates.map((candidate) => (
                <span
                  key={candidate.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#0D1B2A] px-3 py-1.5 text-sm text-[#F5E8C8]"
                >
                  {candidate.name}
                  <button
                    onClick={() => toggleCandidate(candidate.id)}
                    className="ml-0.5 transition-colors hover:text-[#C8922A]"
                    aria-label={`Remove ${candidate.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {selectedIds.length < 4 && (
                <span className="self-center text-xs text-gray-400">
                  {4 - selectedIds.length} more can be added
                </span>
              )}
            </div>
          )}

          <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredCandidates.length === 0 ? (
              <p className="col-span-full py-4 text-center text-sm text-gray-400">
                No candidates found
              </p>
            ) : (
              filteredCandidates.map((candidate) => {
                const isSelected = selectedIds.includes(candidate.id);
                const isDisabled = !isSelected && selectedIds.length >= 4;

                return (
                  <button
                    key={candidate.id}
                    onClick={() => {
                      if (!isDisabled) toggleCandidate(candidate.id);
                    }}
                    disabled={isDisabled}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                      isSelected
                        ? "border-[#0D1B2A] bg-[#0D1B2A] text-[#F5E8C8]"
                        : isDisabled
                          ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                          : "border-gray-200 bg-white text-[#0D1B2A] hover:border-[#A31621] hover:bg-[#A31621]/5"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected
                          ? "bg-[#C8922A] text-[#0D1B2A]"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {candidate.name
                        .split(" ")
                        .map((word) => word[0])
                        .filter(Boolean)
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{candidate.name}</div>
                      <div
                        className={`truncate text-xs ${
                          isSelected ? "text-[#F5E8C8]/70" : "text-gray-400"
                        }`}
                      >
                        {candidate.district}
                      </div>
                    </div>
                    {isSelected && (
                      <svg
                        className="ml-auto h-4 w-4 flex-shrink-0 text-[#C8922A]"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {selectedIds.length} of 4 candidates selected
            </span>
            <button
              onClick={loadComparison}
              disabled={selectedIds.length < 2 || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-[#A31621] px-6 py-2.5 text-sm font-semibold text-[#F5E8C8] transition-colors hover:bg-[#6B1414] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading...
                </>
              ) : (
                "Compare →"
              )}
            </button>
          </div>
        </div>

        {comparisonData.length >= 2 ? (
          <ComparisonTable candidates={comparisonData} />
        ) : null}

        {selectedIds.length >= 2 && comparisonData.length === 0 && !loading && (
          <div className="py-12 text-center text-gray-400">
            <p className="text-sm">
              Click <strong className="text-[#A31621]">Compare →</strong> to see
              the side-by-side comparison
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
