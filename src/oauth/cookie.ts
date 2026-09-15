import { decrypt } from "./crypto";

/** Minimal cookie parsing/serialization — no framework dependency. */

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/** Read + decrypt the GitHub token from a raw Cookie header, or null. */
export function readTokenFromCookieHeader(
  header: string | null | undefined,
  cookieName: string,
  secret: string,
): string | null {
  const raw = parseCookies(header)[cookieName];
  if (!raw) return null;
  try {
    return decrypt(raw, secret);
  } catch {
    return null;
  }
}

export interface CookieOptions {
  maxAge: number;
  secure: boolean;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
}

/** Serialize a Set-Cookie value (httpOnly always on — the token must never reach client JS). */
export function serializeCookie(name: string, value: string, opts: CookieOptions): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path ?? "/"}`,
    `Max-Age=${opts.maxAge}`,
    `SameSite=${(opts.sameSite ?? "lax").replace(/^./, (c) => c.toUpperCase())}`,
    "HttpOnly",
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}
