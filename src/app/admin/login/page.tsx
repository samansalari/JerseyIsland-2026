"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginInner() {
  const sp = useSearchParams();
  const configErr = sp.get("error") === "config";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(typeof j.error === "string" ? j.error : "Invalid credentials");
      setLoading(false);
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#0D1B2A", fontFamily: "Archivo, sans-serif" }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{ backgroundColor: "#F5F5F0" }}
      >
        <div className="text-center mb-8">
          <p className="text-2xl font-bold" style={{ color: "#0D1B2A" }}>
            <span>Vote</span>
            <span style={{ color: "#C8922A" }}>Pulse</span>
          </p>
          <p className="text-sm mt-1.5 font-medium" style={{ color: "rgba(13,27,42,0.45)" }}>
            Admin — restricted access
          </p>
        </div>

        {configErr && (
          <div
            className="mb-4 p-3 rounded-xl text-sm text-center"
            style={{ backgroundColor: "rgba(200,146,42,0.1)", color: "#C8922A" }}
          >
            Set <code className="font-mono text-xs bg-black/10 px-1 py-0.5 rounded">ADMIN_SECRET</code> in Railway environment variables.
          </div>
        )}

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div>
            <label
              className="text-xs font-bold uppercase tracking-wide block mb-1.5"
              style={{ color: "rgba(13,27,42,0.5)" }}
            >
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm bg-white"
              style={{
                border: "1px solid rgba(13,27,42,0.15)",
                outline: "none",
                color: "#0D1B2A",
              }}
            />
          </div>

          {error && (
            <p
              className="text-sm text-center p-2 rounded-lg"
              style={{ backgroundColor: "rgba(163,22,33,0.08)", color: "#A31621" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "#A31621", color: "#F5E8C8" }}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D1B2A]" />}>
      <LoginInner />
    </Suspense>
  );
}
