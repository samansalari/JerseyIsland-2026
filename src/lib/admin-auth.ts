import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

export const ADMIN_COOKIE = "votepulse_admin";

const COOKIE_DATA = "votepulse-admin-v1";

function base64Url(bytes: ArrayBuffer): string {
  const u = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function adminCookieValue(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(COOKIE_DATA));
  return base64Url(sig);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export async function verifyAdminCookie(
  secret: string | undefined,
  request: NextRequest,
): Promise<boolean> {
  if (!secret) return false;
  const expected = await adminCookieValue(secret);
  const got = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!got) return false;
  return timingSafeEqualStr(got, expected);
}

export async function setAdminAuthCookie(
  response: NextResponse,
  secret: string,
): Promise<void> {
  const token = await adminCookieValue(secret);
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAdminAuthCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
