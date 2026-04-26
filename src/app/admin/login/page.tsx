"use client";

import { useState, useEffect, Suspense } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";

// ── Inner form (uses useSearchParams → must be inside Suspense) ──────────────

function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  // Surface any error forwarded from the callback route
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError(decodeURIComponent(err));
  }, [searchParams]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
  );

  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/admin/auth/callback`,
        // Prevents new accounts being created — only existing admin users
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      // Supabase returns a generic error when shouldCreateUser=false and the
      // email is not in the user table — intentionally vague to prevent
      // email enumeration.
      setError(
        "Could not send link. Ensure this email has admin access, or try again in a few minutes.",
      );
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] flex items-center justify-center px-4">
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,.5) 39px,rgba(255,255,255,.5) 40px)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[#A31621] flex items-center justify-center text-[#F5E8C8] font-bold text-sm">
              VP
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Vote<span className="text-[#C8922A]">Pulse</span>
            </span>
          </div>
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Admin Access
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
          {sent ? (
            /* ── Success state ─────────────────────────────── */
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#1A6B3A]/20 border border-[#1A6B3A]/40 flex items-center justify-center mx-auto text-2xl">
                ✉️
              </div>
              <h2 className="text-white font-bold text-lg">Check your email</h2>
              <p className="text-white/60 text-sm leading-relaxed">
                We sent a sign-in link to{" "}
                <span className="text-[#F5E8C8] font-medium">{email}</span>.
                Click it to access the admin dashboard.
              </p>
              <p className="text-white/40 text-xs">
                Link expires in 1 hour. Check spam if not received.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-xs text-white/40 hover:text-white/70 transition-colors mt-4 underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* ── Email entry form ──────────────────────────── */
            <form onSubmit={handleSendLink} className="space-y-5">
              <div>
                <h2 className="text-white font-bold text-lg mb-1">Sign in</h2>
                <p className="text-white/50 text-sm">
                  Enter your admin email to receive a sign-in link.
                </p>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-white/50 uppercase tracking-widest mb-2"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@votepulse.je"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#C8922A]/60 focus:ring-1 focus:ring-[#C8922A]/40 text-sm transition-colors"
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-[#A31621]/20 border border-[#A31621]/30">
                  <p className="text-[#F5E8C8] text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-[#A31621] text-[#F5E8C8] hover:bg-[#8B1217] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A31621] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1B2A]"
              >
                {loading ? "Sending…" : "Send sign-in link →"}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <a
            href="/"
            className="text-white/30 hover:text-white/60 text-xs transition-colors"
          >
            ← Back to VotePulse
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Page export — useSearchParams requires Suspense in Next.js 15 ────────────

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
