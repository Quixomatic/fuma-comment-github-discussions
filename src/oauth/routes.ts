import { NextResponse } from "next/server";

import { serializeCookie } from "./cookie";
import { decodeState, encodeState, encrypt } from "./crypto";
import { DEFAULT_COOKIE } from "../types";

/**
 * Reference GitHub OAuth flow for Next (App Router). Provides `login`, `callback`, and `logout` route
 * handlers. The user token is exchanged server-side and stored in an httpOnly, encrypted cookie, so it
 * never reaches the browser. Mount these under a base path and register the callback URL on your OAuth
 * App. This flow is optional — supply your own `getToken`/cookie if you already have GitHub auth.
 */

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_ACCESS_TOKEN = "https://github.com/login/oauth/access_token";
const ONE_YEAR = 60 * 60 * 24 * 365;

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** Must match the adapter's `tokenSecret` (encrypts state + the cookie). */
  tokenSecret: string;
  /** Cookie name; must match the adapter's `cookieName`. Default `fcgd_token`. */
  cookieName?: string;
  /** OAuth scope. Default `public_repo` (write to discussions on a public repo). */
  scope?: string;
  /** Path the callback handler is mounted at. Default `/api/comments/oauth/callback`. */
  callbackPath?: string;
  /** Fallback path to return to. Default `/`. */
  defaultReturnPath?: string;
  /** Cookie lifetime (seconds). Default 1 year. */
  maxAge?: number;
  /** Force the cookie Secure flag. Default: true in production. */
  secure?: boolean;
}

export interface OAuthRoutes {
  login: (request: Request) => Promise<NextResponse> | NextResponse;
  callback: (request: Request) => Promise<NextResponse>;
  logout: (request: Request) => NextResponse;
}

function origin(request: Request): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(request.url).host;
  return `${proto}://${host}`;
}

function sameOrigin(candidate: string | null, self: string, fallback: string): string {
  if (!candidate) return `${self}${fallback}`;
  try {
    const parsed = new URL(candidate, self);
    return parsed.origin === self ? parsed.href : `${self}${fallback}`;
  } catch {
    return `${self}${fallback}`;
  }
}

export function createOAuthRoutes(config: GitHubOAuthConfig): OAuthRoutes {
  const cookieName = config.cookieName ?? DEFAULT_COOKIE;
  const scope = config.scope ?? "public_repo";
  const callbackPath = config.callbackPath ?? "/api/comments/oauth/callback";
  const fallback = config.defaultReturnPath ?? "/";
  const maxAge = config.maxAge ?? ONE_YEAR;
  const secure = config.secure ?? process.env.NODE_ENV === "production";

  return {
    login(request) {
      const self = origin(request);
      const url = new URL(request.url);
      const returnUrl = sameOrigin(url.searchParams.get("return"), self, fallback);
      const state = encodeState(returnUrl, config.tokenSecret);
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: `${self}${callbackPath}`,
        scope,
        state,
      });
      return NextResponse.redirect(`${GITHUB_AUTHORIZE}?${params.toString()}`);
    },

    async callback(request) {
      const self = origin(request);
      const url = new URL(request.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      let returnUrl = `${self}${fallback}`;
      if (state) {
        try {
          returnUrl = decodeState(state, config.tokenSecret);
        } catch {
          return NextResponse.json({ message: "Invalid or expired sign-in state" }, { status: 400 });
        }
      }
      if (error || !code) return NextResponse.redirect(returnUrl);

      let accessToken: string;
      try {
        const res = await fetch(GITHUB_ACCESS_TOKEN, {
          method: "POST",
          headers: { Accept: "application/json", "User-Agent": "fuma-comment-github-discussions" },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
          }),
        });
        if (!res.ok) throw new Error(`token exchange status ${res.status}`);
        const data = (await res.json()) as { access_token?: string; error?: string };
        if (!data.access_token) throw new Error(data.error ?? "no access_token");
        accessToken = data.access_token;
      } catch {
        return NextResponse.json({ message: "GitHub sign-in failed" }, { status: 502 });
      }

      const response = NextResponse.redirect(returnUrl);
      response.headers.append(
        "Set-Cookie",
        serializeCookie(cookieName, encrypt(accessToken, config.tokenSecret), { maxAge, secure }),
      );
      return response;
    },

    logout(request) {
      const self = origin(request);
      const url = new URL(request.url);
      const returnUrl = sameOrigin(url.searchParams.get("return"), self, fallback);
      const response = NextResponse.redirect(returnUrl);
      response.headers.append("Set-Cookie", serializeCookie(cookieName, "", { maxAge: 0, secure }));
      return response;
    },
  };
}
