import { Resend } from "resend";
import { env } from "@/lib/env";

let singleton: Resend | null = null;

/** Resend client when `RESEND_API_KEY` is set; otherwise `null`. */
export function getResend(): Resend | null {
  const key = env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!singleton) singleton = new Resend(key);
  return singleton;
}

/** Same as `getResend()` but throws if the key is missing (e.g. API route handlers). */
export function requireResend(): Resend {
  const client = getResend();
  if (!client) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return client;
}
