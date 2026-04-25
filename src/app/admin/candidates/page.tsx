import { db } from "@/db";
import { candidates } from "@/db/schema";
import { isNotNull, isNull, asc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

const FILTERS = ["all", "pending", "enriched"] as const;
type Filter = (typeof FILTERS)[number];

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = (FILTERS.includes(sp.filter as Filter) ? sp.filter : "all") as Filter;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const limit = 30;
  const offset = (page - 1) * limit;

  const baseQuery = db
    .select({
      id: candidates.id,
      name: candidates.name,
      slug: candidates.slug,
      district: candidates.district,
      party: candidates.party,
      aiSummary: candidates.aiSummary,
      aiIssues: candidates.aiIssues,
      socialLinks: candidates.socialLinks,
      lastEnrichedAt: candidates.lastEnrichedAt,
      lastScrapedAt: candidates.lastScrapedAt,
    })
    .from(candidates);

  let rows;
  if (filter === "pending") {
    rows = await baseQuery
      .where(isNull(candidates.aiSummary))
      .orderBy(asc(candidates.name))
      .limit(limit)
      .offset(offset);
  } else if (filter === "enriched") {
    rows = await baseQuery
      .where(isNotNull(candidates.aiSummary))
      .orderBy(asc(candidates.name))
      .limit(limit)
      .offset(offset);
  } else {
    rows = await baseQuery
      .orderBy(asc(candidates.name))
      .limit(limit)
      .offset(offset);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>
          Candidates
        </h1>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`/admin/candidates?filter=${f}`}
              className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
              style={{
                backgroundColor:
                  filter === f ? "#0D1B2A" : "rgba(13,27,42,0.06)",
                color: filter === f ? "#F5E8C8" : "#0D1B2A",
              }}
            >
              {f}
            </Link>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(13,27,42,0.1)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: "#f8f8f6" }}>
              <tr>
                {[
                  "Name",
                  "District",
                  "Party",
                  "AI Summary",
                  "Issues",
                  "Social",
                  "Last Enriched",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide"
                    style={{ color: "rgba(13,27,42,0.5)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr
                  key={c.id}
                  style={{
                    borderTop: "1px solid rgba(13,27,42,0.06)",
                    backgroundColor: i % 2 === 0 ? "#fff" : "#fafaf8",
                  }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/candidates/${c.slug}`}
                      className="text-sm font-medium hover:underline"
                      style={{ color: "#0D1B2A" }}
                      target="_blank"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs"
                      style={{ color: "rgba(13,27,42,0.6)" }}
                    >
                      {c.district || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs"
                      style={{ color: "rgba(13,27,42,0.6)" }}
                    >
                      {c.party || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: c.aiSummary
                          ? "rgba(26,107,58,0.1)"
                          : "rgba(200,146,42,0.1)",
                        color: c.aiSummary ? "#1A6B3A" : "#C8922A",
                      }}
                    >
                      {c.aiSummary ? "✓ Done" : "⏳ Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs"
                      style={{ color: "rgba(13,27,42,0.5)" }}
                    >
                      {Array.isArray(c.aiIssues)
                        ? `${(c.aiIssues as unknown[]).length} issues`
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs"
                      style={{ color: "rgba(13,27,42,0.5)" }}
                    >
                      {c.socialLinks ? "✓" : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs"
                      style={{ color: "rgba(13,27,42,0.5)" }}
                    >
                      {c.lastEnrichedAt
                        ? new Date(c.lastEnrichedAt).toLocaleDateString(
                            "en-GB",
                          )
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/candidates/${c.slug}`}
                      target="_blank"
                      className="text-xs font-medium hover:underline"
                      style={{ color: "#A31621" }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && (
          <div
            className="py-12 text-center text-sm"
            style={{ color: "rgba(13,27,42,0.4)" }}
          >
            No candidates found.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-6">
        {page > 1 && (
          <Link
            href={`/admin/candidates?filter=${filter}&page=${page - 1}`}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "#0D1B2A", color: "#F5E8C8" }}
          >
            ← Previous
          </Link>
        )}
        {rows.length === limit && (
          <Link
            href={`/admin/candidates?filter=${filter}&page=${page + 1}`}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "#0D1B2A", color: "#F5E8C8" }}
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
