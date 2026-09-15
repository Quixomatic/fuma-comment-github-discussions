import type { AuthAdapter } from "@fuma-comment/server";
import type { CustomRequest } from "@fuma-comment/server/custom";

import type { GitHubClient } from "./github";
import { readTokenFromCookieHeader } from "./oauth/cookie";
import { DEFAULT_COOKIE, type GitHubAuthInfo, type GitHubDiscussionsConfig } from "./types";

/**
 * Auth adapter: reads the reader's GitHub token from the (httpOnly, encrypted) cookie, resolves their
 * login, and returns it as the session `id` WITH the token attached. fuma-comment passes that object
 * straight to the storage methods, which is how they act on GitHub as the signed-in user.
 */

function headerValue(v: string | readonly string[] | undefined): string | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : (v as string);
}

// Best-effort token -> login cache so a burst of reads doesn't hit the viewer endpoint every time.
const LOGIN_TTL_MS = 5 * 60 * 1000;

export function createAuth(
  config: GitHubDiscussionsConfig,
  client: GitHubClient,
): AuthAdapter<CustomRequest> {
  const cookieName = config.cookieName ?? DEFAULT_COOKIE;
  const cache = new Map<string, { login: string; exp: number }>();

  async function resolveLogin(token: string): Promise<string | null> {
    const hit = cache.get(token);
    if (hit && hit.exp > Date.now()) return hit.login;
    const login = await client.getViewerLogin(token);
    if (login) cache.set(token, { login, exp: Date.now() + LOGIN_TTL_MS });
    return login;
  }

  return {
    async getSession(request) {
      const token = readTokenFromCookieHeader(
        headerValue(request.headers.get("cookie")),
        cookieName,
        config.tokenSecret,
      );
      if (!token) return null;
      const login = await resolveLogin(token);
      if (!login) return null;
      const session: GitHubAuthInfo = { id: login, token };
      return session;
    },
  };
}
