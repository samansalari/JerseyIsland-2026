"use client";

import { useState } from "react";

interface Action {
  label: string;
  description: string;
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
  color: string;
  icon: string;
  confirm?: string;
}

const ACTIONS: Action[] = [
  {
    label: "Scrape flow.je",
    description: "Re-scrape all candidate profiles from flow.je",
    endpoint: "/api/admin/run-scraper",
    method: "POST",
    body: { scraperName: "flow_je" },
    color: "#1565C0",
    icon: "🔄",
    confirm: "This will re-scrape all candidates. Continue?",
  },
  {
    label: "Scrape vote.je",
    description: "Pull candidate data from vote.je",
    endpoint: "/api/admin/run-scraper",
    method: "POST",
    body: { scraperName: "vote_je" },
    color: "#1565C0",
    icon: "📋",
  },
  {
    label: "Enrich All Candidates",
    description: "Run Grok AI enrichment on pending candidates",
    endpoint: "/api/admin/enrich-batch",
    color: "#C8922A",
    icon: "🤖",
    confirm: "This will use Grok API credits. Continue?",
  },
  {
    label: "Ingest News",
    description: "Pull latest Jersey election news articles",
    endpoint: "/api/admin/run-scraper",
    method: "POST",
    body: { scraperName: "ingest_news" },
    color: "#1A6B3A",
    icon: "📰",
  },
  {
    label: "Regenerate Insight",
    description: "Force-regenerate the Grok pulse insight now",
    endpoint: "/api/admin/regenerate-insight",
    color: "#0D1B2A",
    icon: "⚡",
  },
  {
    label: "Clear Poll Data",
    description: "Reset all issue votes and candidate ratings",
    endpoint: "/api/admin/clear-pulse",
    color: "#A31621",
    icon: "🗑️",
    confirm: "This will DELETE all votes and ratings. Are you sure?",
  },
];

export function AdminActions() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  async function runAction(action: Action) {
    if (action.confirm && !window.confirm(action.confirm)) return;

    const key = `${action.endpoint}:${action.label}`;
    setRunning(key);
    setResults((prev) => ({ ...prev, [key]: "Running…" }));

    try {
      const res = await fetch(action.endpoint, {
        method: action.method ?? "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body ?? {}),
      });
      const data = await res.json().catch(() => ({}));

      setResults((prev) => ({
        ...prev,
        [key]: res.ok
          ? `✅ ${(data as { message?: string; outputTail?: string }).message ?? (data as { outputTail?: string }).outputTail?.slice(0, 80) ?? "Done"}`
          : `❌ ${(data as { error?: string }).error ?? "Failed"}`,
      }));
    } catch {
      setResults((prev) => ({ ...prev, [key]: "❌ Network error" }));
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-2">
      {ACTIONS.map((action) => {
        const key = `${action.endpoint}:${action.label}`;
        const isRunning = running === key;
        const result = results[key];
        return (
          <div key={key}>
            <button
              onClick={() => void runAction(action)}
              disabled={running !== null}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: `${action.color}10`,
                border: `1px solid ${action.color}30`,
                color: action.color,
              }}
            >
              <span className="text-lg flex-shrink-0">
                {isRunning ? "⏳" : action.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{action.label}</p>
                <p className="text-xs opacity-70">{action.description}</p>
              </div>
            </button>
            {result && (
              <p
                className="text-xs mt-1 px-4 py-1.5 rounded-lg"
                style={{
                  backgroundColor: result.startsWith("✅")
                    ? "rgba(26,107,58,0.08)"
                    : "rgba(163,22,33,0.08)",
                  color: result.startsWith("✅") ? "#1A6B3A" : "#A31621",
                }}
              >
                {result}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
