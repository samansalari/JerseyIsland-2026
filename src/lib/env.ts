import { z } from "zod";

/**
 * Runtime-validated environment.
 *
 * Anything read at runtime (server components, API routes, drizzle-kit)
 * should import `env` from here rather than touching `process.env`
 * directly, so we fail fast on missing/malformed values.
 */
const EnvSchema = z.object({
  /** Do not use `.url()` — valid Postgres URIs often fail WHATWG URL parsing. */
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must start with postgres:// or postgresql://",
    ),
  /**
   * URL used by `drizzle-kit push` (see `drizzle.config.ts`). Prefer this over
   * the transaction pooler in `DATABASE_URL` for schema introspection.
   *
   * - **IPv6 (or Supabase IPv4 add-on):** Dashboard → Connect → *Direct connection*
   *   (`postgresql://postgres:…@db.<project-ref>.supabase.co:5432/postgres`).
   * - **IPv4-only (default Supabase):** use *Session pooler* (port **5432**), not
   *   `db.*.supabase.co`. Host is like `aws-0-<region>.pooler.supabase.com` or
   *   `aws-1-<region>.pooler.supabase.com` — copy the exact host from Connect.
   *   Same settings as `psql`: `-h` host, `-p 5432`, `-U postgres.<project-ref>`, `-d postgres`
   *   → URI: `postgresql://postgres.<ref>:PASSWORD@<host>:5432/postgres`
   *
   * See https://supabase.com/docs/guides/database/connecting-to-postgres
   */
  DIRECT_URL: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .string()
        .refine(
          (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
          "DIRECT_URL must start with postgres:// or postgresql://",
        )
        .optional(),
    ),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  SKIP_DB_HEALTHCHECK: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  /** Cookie-based admin UI (`/admin`). If empty, admin login is disabled. */
  ADMIN_SECRET: z.string().optional().default(""),
  /** xAI Grok (optional until you run enrichment scripts). */
  GROK_API_KEY: z.string().optional(),
  GROK_MODEL: z.string().optional(),
  /** Resend transactional email (https://resend.com). Optional until you send mail. */
  RESEND_API_KEY: z.string().optional().default(""),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Surface a clean error instead of letting Zod's raw output leak
  // into serverless logs.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment variables:\n${issues}\n\nCheck your .env.local against .env.example.`,
  );
}

export const env = parsed.data;
