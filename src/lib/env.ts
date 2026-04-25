/**
 * Lazy server environment: no validation runs at import time (Railway/CI
 * `next build` may not have secrets or DATABASE_URL). Access fields when needed;
 * `DATABASE_URL` throws only when read outside a build placeholder context.
 */

const BUILD_PLACEHOLDER_DATABASE_URL =
  "postgresql://votepulse_build:unused@127.0.0.1:1/postgres";

function isNextBuildWithoutDatabaseUrl(): boolean {
  if (process.env.DATABASE_URL?.trim()) return false;
  return (
    process.env.npm_lifecycle_event === "build" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-build"
  );
}

function requirePostgresUrl(value: string, name: string): string {
  if (!value.startsWith("postgres://") && !value.startsWith("postgresql://")) {
    throw new Error(
      `${name} must start with postgres:// or postgresql://`,
    );
  }
  return value;
}

function resolveDatabaseUrlForRead(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return requirePostgresUrl(fromEnv, "DATABASE_URL");
  }
  if (isNextBuildWithoutDatabaseUrl()) {
    return BUILD_PLACEHOLDER_DATABASE_URL;
  }
  throw new Error(
    "DATABASE_URL is required. Set it in Railway variables or .env.local — see .env.example.",
  );
}

function resolveDirectUrlForRead(): string | undefined {
  const v = process.env.DIRECT_URL?.trim();
  if (!v) return undefined;
  return requirePostgresUrl(v, "DIRECT_URL");
}

function resolveSiteUrlForRead(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  try {
    // eslint-disable-next-line no-new
    new URL(raw);
    return raw;
  } catch {
    return "http://localhost:3000";
  }
}

function resolveNodeEnvForRead(): "development" | "test" | "production" {
  const n = process.env.NODE_ENV;
  if (n === "development" || n === "test" || n === "production") return n;
  return "development";
}

function resolveSkipDbHealthcheckForRead(): boolean {
  return process.env.SKIP_DB_HEALTHCHECK === "true";
}

export type AppEnv = {
  readonly DATABASE_URL: string;
  readonly DIRECT_URL: string | undefined;
  readonly NEXT_PUBLIC_SITE_URL: string;
  readonly SKIP_DB_HEALTHCHECK: boolean;
  readonly NODE_ENV: "development" | "test" | "production";
  readonly GROK_API_KEY: string | undefined;
  readonly GROK_MODEL: string | undefined;
  readonly RESEND_API_KEY: string;
  /** Public Supabase project URL (optional until Supabase is wired in that path). */
  readonly NEXT_PUBLIC_SUPABASE_URL: string;
  /** Legacy anon / publishable key names — empty if unset. */
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly REVALIDATION_SECRET: string;
};

/**
 * Server-only secret accessors — never import these in 'use client' components.
 * They throw at runtime if the env var is missing.
 */
function requireServerEnv(key: string): string {
  const val = process.env[key]?.trim();
  if (!val) throw new Error(`Missing required server environment variable: ${key}`);
  return val;
}

export const getGrokApiKey = () => requireServerEnv("GROK_API_KEY");
export const getFirecrawlApiKey = () => requireServerEnv("FIRECRAWL_API_KEY");
export const getSupabaseServiceKey = () =>
  requireServerEnv("SUPABASE_SERVICE_ROLE_KEY");

// Public vars (safe for browser) — access via env object below
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

export const env: AppEnv = {
  get DATABASE_URL() {
    return resolveDatabaseUrlForRead();
  },
  get DIRECT_URL() {
    return resolveDirectUrlForRead();
  },
  get NEXT_PUBLIC_SITE_URL() {
    return resolveSiteUrlForRead();
  },
  get SKIP_DB_HEALTHCHECK() {
    return resolveSkipDbHealthcheckForRead();
  },
  get NODE_ENV() {
    return resolveNodeEnvForRead();
  },
  get GROK_API_KEY() {
    const v = process.env.GROK_API_KEY?.trim();
    return v || undefined;
  },
  get GROK_MODEL() {
    const v = process.env.GROK_MODEL?.trim();
    return v || undefined;
  },
  get RESEND_API_KEY() {
    return process.env.RESEND_API_KEY?.trim() ?? "";
  },
  get NEXT_PUBLIC_SUPABASE_URL() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  },
  get NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY() {
    return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  },
  get REVALIDATION_SECRET() {
    return process.env.REVALIDATION_SECRET?.trim() ?? "";
  },
};
