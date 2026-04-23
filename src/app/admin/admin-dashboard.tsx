"use client";

import { useCallback, useEffect, useState } from "react";

type CandidateRow = {
  id: string;
  slug: string;
  name: string;
  district: string;
  party: string | null;
  hasManifesto: boolean;
  hasSummary: boolean;
  lastEnrichedAt: string | null;
};

type HealthPayload = {
  candidateStats: {
    total: number;
    enriched: number;
    withManifesto: number;
  };
  articles: { total: number; enriched: number };
  cron: {
    lastScrape: Record<string, string | null>;
    lastScrapeResult: Record<string, string | null>;
    lastEnrichment: string | null;
    lastEnrichmentResult: string | null;
    lastNewsIngest: string | null;
    lastNewsIngestResult: string | null;
    lastArticleEnrichment: string | null;
    lastEnrichArticlesResult: string | null;
  };
  warnings: string[];
  candidates: CandidateRow[];
};

const SCRAPERS: { name: string; label: string }[] = [
  { name: "flow_je", label: "flow.je scraper" },
  { name: "vote_je", label: "vote.je scraper" },
  { name: "policy_je", label: "policy.je scraper" },
  { name: "ingest_news", label: "News ingest" },
  { name: "enrich_articles", label: "Article enrichment" },
];

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

function resultLabel(
  cron: HealthPayload["cron"],
  key: "flow_je" | "vote_je" | "policy_je",
): string {
  const r = cron.lastScrapeResult?.[key];
  if (r === "success") return "success";
  if (r === "fail") return "fail";
  return "—";
}

export function AdminDashboard() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editManifesto, setEditManifesto] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const [newName, setNewName] = useState("");
  const [newDistrict, setNewDistrict] = useState("");
  const [newParty, setNewParty] = useState("");
  const [newBio, setNewBio] = useState("");
  const [newManifesto, setNewManifesto] = useState("");
  const [newManifestoUrl, setNewManifestoUrl] = useState("");
  const [newSources, setNewSources] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/health", { credentials: "include" });
    if (!r.ok) {
      setLoadErr(await r.text());
      setData(null);
      return;
    }
    const j = (await r.json()) as HealthPayload;
    setData(j);
    setLoadErr(null);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function postJson(url: string, body: unknown) {
    setBusy(url);
    setMsg(null);
    try {
      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: unknown;
        outputTail?: string;
      };
      if (!r.ok) {
        setMsg(
          typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? j),
        );
      } else {
        setMsg(
          j.outputTail
            ? `OK — ${j.outputTail.slice(0, 500)}`
            : "OK",
        );
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function openEdit(id: string) {
    setEditId(id);
    setEditManifesto("");
    setEditBio("");
    setEditUrl("");
    const r = await fetch(`/api/admin/candidates?id=${id}`, {
      credentials: "include",
    });
    if (!r.ok) {
      setMsg("Failed to load candidate for edit");
      setEditId(null);
      return;
    }
    const j = (await r.json()) as {
      manifesto_raw?: string | null;
      bio?: string | null;
      manifesto_url?: string | null;
    };
    setEditManifesto(j.manifesto_raw ?? "");
    setEditBio(j.bio ?? "");
    setEditUrl(j.manifesto_url ?? "");
  }

  async function saveEdit() {
    if (!editId) return;
    await postJson("/api/admin/candidates", {
      id: editId,
      manifesto_raw: editManifesto || null,
      bio: editBio || null,
      manifesto_url: editUrl || null,
    });
    setEditId(null);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    window.location.href = "/admin/login";
  }

  if (loadErr) {
    return (
      <div className="p-6">
        <p className="text-red-700">Failed to load: {loadErr}</p>
        <button type="button" className="mt-2 underline" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return <p className="p-6">Loading…</p>;
  }

  const cron = data.cron;
  const stats = data.candidateStats;

  return (
    <div className="space-y-10 p-4 font-mono text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">VotePulse admin</h1>
        <button type="button" className="underline" onClick={() => void logout()}>
          Log out
        </button>
      </div>

      {msg && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-neutral-400 bg-neutral-100 p-2 text-[12px]">
          {msg}
        </pre>
      )}

      <section>
        <h2 className="mb-2 font-bold">1. System health</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Candidates: total {stats.total} / enriched {stats.enriched} / with
            manifesto {stats.withManifesto}
          </li>
          <li>
            Articles: total {data.articles.total} / enriched{" "}
            {data.articles.enriched}
          </li>
          <li>
            Last candidate enrichment: {fmt(cron.lastEnrichment)} (
            {cron.lastEnrichmentResult ?? "—"})
          </li>
          <li>
            Last news ingest: {fmt(cron.lastNewsIngest)} (
            {cron.lastNewsIngestResult ?? "—"})
          </li>
          <li>
            Last article enrichment: {fmt(cron.lastArticleEnrichment)} (
            {cron.lastEnrichArticlesResult ?? "—"})
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-bold">2. Candidates</h2>
        <div className="overflow-x-auto border border-neutral-400">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-400 bg-neutral-200">
                <th className="p-1">Name</th>
                <th className="p-1">District</th>
                <th className="p-1">Party</th>
                <th className="p-1">Manifesto</th>
                <th className="p-1">Summary</th>
                <th className="p-1">Last enriched</th>
                <th className="p-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map((c) => (
                <tr key={c.id} className="border-b border-neutral-300">
                  <td className="p-1">{c.name}</td>
                  <td className="p-1">{c.district}</td>
                  <td className="p-1">{c.party ?? "—"}</td>
                  <td className="p-1">{c.hasManifesto ? "✓" : "✗"}</td>
                  <td className="p-1">{c.hasSummary ? "✓" : "✗"}</td>
                  <td className="p-1">{fmt(c.lastEnrichedAt)}</td>
                  <td className="space-x-1 p-1">
                    <button
                      type="button"
                      className="underline disabled:opacity-40"
                      disabled={!!busy}
                      onClick={() =>
                        void postJson("/api/admin/re-enrich", {
                          candidateId: c.id,
                        })
                      }
                    >
                      Re-enrich
                    </button>
                    <button
                      type="button"
                      className="underline"
                      disabled={!!busy}
                      onClick={() => void openEdit(c.id)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editId && (
          <div className="mt-3 space-y-2 rounded border border-neutral-400 p-2">
            <p className="font-bold">Editing {editId}</p>
            <label className="block">
              manifesto_url
              <input
                className="mt-0.5 w-full border border-neutral-400 p-1"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </label>
            <label className="block">
              bio
              <textarea
                className="mt-0.5 h-20 w-full border border-neutral-400 p-1"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
              />
            </label>
            <label className="block">
              manifesto_raw
              <textarea
                className="mt-0.5 h-40 w-full border border-neutral-400 p-1"
                value={editManifesto}
                onChange={(e) => setEditManifesto(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="border border-neutral-600 px-2 py-0.5"
                disabled={!!busy}
                onClick={() => void saveEdit()}
              >
                Save
              </button>
              <button type="button" className="underline" onClick={() => setEditId(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold">3. Scrapers</h2>
        <table className="w-full border-collapse border border-neutral-400">
          <thead>
            <tr className="bg-neutral-200">
              <th className="border border-neutral-400 p-1 text-left">Scraper</th>
              <th className="border border-neutral-400 p-1 text-left">Last run</th>
              <th className="border border-neutral-400 p-1 text-left">Result</th>
              <th className="border border-neutral-400 p-1 text-left">Run now</th>
            </tr>
          </thead>
          <tbody>
            {SCRAPERS.map(({ name, label }) => {
              let last = "—";
              let res: string = "—";
              if (name === "flow_je") {
                last = fmt(cron.lastScrape?.flow_je);
                res = resultLabel(cron, "flow_je");
              } else if (name === "vote_je") {
                last = fmt(cron.lastScrape?.vote_je);
                res = resultLabel(cron, "vote_je");
              } else if (name === "policy_je") {
                last = fmt(cron.lastScrape?.policy_je);
                res = resultLabel(cron, "policy_je");
              } else if (name === "ingest_news") {
                last = fmt(cron.lastNewsIngest);
                res = cron.lastNewsIngestResult ?? "—";
              } else if (name === "enrich_articles") {
                last = fmt(cron.lastArticleEnrichment);
                res = cron.lastEnrichArticlesResult ?? "—";
              }
              return (
                <tr key={name}>
                  <td className="border border-neutral-400 p-1">{label}</td>
                  <td className="border border-neutral-400 p-1">{last}</td>
                  <td className="border border-neutral-400 p-1">{res}</td>
                  <td className="border border-neutral-400 p-1">
                    <button
                      type="button"
                      className="underline disabled:opacity-40"
                      disabled={!!busy}
                      onClick={() =>
                        void postJson("/api/admin/run-scraper", { scraperName: name })
                      }
                    >
                      Run
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 font-bold">4. Add candidate</h2>
        <div className="grid max-w-xl grid-cols-1 gap-2">
          <input
            placeholder="name"
            className="border border-neutral-400 p-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            placeholder="district (exact parish name)"
            className="border border-neutral-400 p-1"
            value={newDistrict}
            onChange={(e) => setNewDistrict(e.target.value)}
          />
          <input
            placeholder="party (optional)"
            className="border border-neutral-400 p-1"
            value={newParty}
            onChange={(e) => setNewParty(e.target.value)}
          />
          <textarea
            placeholder="bio"
            className="h-16 border border-neutral-400 p-1"
            value={newBio}
            onChange={(e) => setNewBio(e.target.value)}
          />
          <textarea
            placeholder="manifesto_raw"
            className="h-24 border border-neutral-400 p-1"
            value={newManifesto}
            onChange={(e) => setNewManifesto(e.target.value)}
          />
          <input
            placeholder="manifesto_url"
            className="border border-neutral-400 p-1"
            value={newManifestoUrl}
            onChange={(e) => setNewManifestoUrl(e.target.value)}
          />
          <textarea
            placeholder="source_urls (one per line or comma-separated)"
            className="h-16 border border-neutral-400 p-1"
            value={newSources}
            onChange={(e) => setNewSources(e.target.value)}
          />
          <button
            type="button"
            className="w-fit border border-neutral-600 px-2 py-1"
            disabled={!!busy}
            onClick={() =>
              void postJson("/api/admin/candidates", {
                name: newName,
                district: newDistrict,
                party: newParty || null,
                bio: newBio || null,
                manifesto_raw: newManifesto || null,
                manifesto_url: newManifestoUrl || null,
                source_urls: newSources,
              }).then(() => {
                setNewName("");
                setNewDistrict("");
                setNewParty("");
                setNewBio("");
                setNewManifesto("");
                setNewManifestoUrl("");
                setNewSources("");
              })
            }
          >
            Create candidate
          </button>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-bold">5. Warnings (auto-refresh 30s)</h2>
        <ul className="max-h-64 list-inside list-decimal overflow-auto rounded border border-amber-700 bg-amber-50 p-2 text-[12px]">
          {data.warnings.length === 0 ? (
            <li>No warnings in log file.</li>
          ) : (
            data.warnings.map((w, i) => (
              <li key={i} className="break-all">
                {w}
              </li>
            ))
          )}
        </ul>
      </section>

      {busy && <p className="text-neutral-600">Working: {busy}…</p>}
    </div>
  );
}
