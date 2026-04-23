"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginInner() {
  const sp = useSearchParams();
  const configErr = sp.get("error") === "config";
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(typeof j.error === "string" ? j.error : "Login failed");
      setLoading(false);
      return;
    }
    window.location.href = "/admin";
  }

  return (
    <div className="mx-auto max-w-sm p-6 font-mono text-sm">
      <h1 className="text-lg font-bold">Admin login</h1>
      {configErr && (
        <p className="mt-2 text-amber-800">
          Set <code className="rounded bg-neutral-200 px-1">ADMIN_SECRET</code> in
          environment.
        </p>
      )}
      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
        <label className="block">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full border border-neutral-500 p-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {msg && <p className="text-red-700">{msg}</p>}
        <button
          type="submit"
          disabled={loading}
          className="border border-neutral-800 px-3 py-1 disabled:opacity-50"
        >
          {loading ? "…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<p className="p-6 font-mono text-sm">Loading…</p>}>
      <LoginInner />
    </Suspense>
  );
}
