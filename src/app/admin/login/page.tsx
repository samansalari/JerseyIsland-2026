import type { Metadata } from "next";
import { login } from "./actions";

export const metadata: Metadata = {
  title: { absolute: "Admin Login | VotePulse" },
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;

  const errorMessage =
    sp.error === "invalid_credentials"
      ? "Incorrect email or password."
      : sp.error === "unauthorized"
        ? "You are not authorised to access this area."
        : sp.error === "missing_fields"
          ? "Please enter your email and password."
          : sp.error === "config"
            ? "Supabase is not configured on this server."
            : sp.error
              ? "Something went wrong. Please try again."
              : null;

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 bg-[#0D1B2A]">
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.5) 39px, rgba(255,255,255,0.5) 40px)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        {/* VotePulse wordmark */}
        <div className="text-center mb-10">
          <div className="inline-flex items-baseline gap-0.5 mb-2">
            <span className="text-3xl font-bold text-[#F5E8C8]">Vote</span>
            <span className="text-3xl font-bold text-[#C8922A]">Pulse</span>
          </div>
          <p className="text-sm text-[#F5E8C8]/40 tracking-widest uppercase">
            Admin Access
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          {/* Error message */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-[#A31621]/20 border border-[#A31621]/40">
              <p className="text-sm text-[#F5E8C8] text-center">
                {errorMessage}
              </p>
            </div>
          )}

          <form action={login} className="space-y-5">
            {sp.redirectTo && (
              <input
                type="hidden"
                name="redirectTo"
                value={sp.redirectTo}
              />
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-[#F5E8C8]/60 uppercase tracking-wide mb-2"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-[#F5E8C8] placeholder-[#F5E8C8]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8922A]/50 focus:border-[#C8922A]/50 transition-colors"
                placeholder="admin@votepulse.je"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-[#F5E8C8]/60 uppercase tracking-wide mb-2"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-[#F5E8C8] placeholder-[#F5E8C8]/30 text-sm focus:outline-none focus:ring-2 focus:ring-[#C8922A]/50 focus:border-[#C8922A]/50 transition-colors"
                placeholder="••••••••••••"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 px-6 rounded-xl bg-[#A31621] hover:bg-[#6B1414] text-[#F5E8C8] text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#C8922A]/50 mt-2"
            >
              Sign in
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-xs text-[#F5E8C8]/30 hover:text-[#F5E8C8]/60 transition-colors"
          >
            ← Back to VotePulse
          </a>
        </div>
      </div>
    </div>
  );
}
