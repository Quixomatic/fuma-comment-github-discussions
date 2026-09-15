import { githubDiscussions } from "fuma-comment-github-discussions";
import { createOAuthRoutes } from "fuma-comment-github-discussions/next";

/**
 * SERVER ONLY. Reads env once and builds the storage/auth adapter + the OAuth routes, so the route
 * handlers stay one line each. `cookieName` + `tokenSecret` are shared between the adapter (which reads
 * the cookie) and the OAuth routes (which set it).
 *
 * The package is agnostic to env var names — it takes plain values. The `GITHUB_COMMENTS_*` names here
 * are just this app's convention; source these however you like.
 */

const COOKIE_NAME = "gh_comment_token";

function tokenSecret(): string {
  return process.env.GITHUB_COMMENTS_TOKEN_SECRET ?? "";
}

/** Build-time gate: render the widget only when everything needed to sign in and post is present. */
export function commentsEnabled(): boolean {
  return Boolean(
    process.env.GITHUB_COMMENTS_CLIENT_ID &&
      process.env.GITHUB_COMMENTS_CLIENT_SECRET &&
      tokenSecret() &&
      process.env.GITHUB_COMMENTS_REPO &&
      process.env.GITHUB_COMMENTS_REPO_ID &&
      process.env.GITHUB_COMMENTS_CATEGORY_ID,
  );
}

export function commentsAdapter() {
  return githubDiscussions({
    repo: process.env.GITHUB_COMMENTS_REPO!,
    repoId: process.env.GITHUB_COMMENTS_REPO_ID!,
    categoryId: process.env.GITHUB_COMMENTS_CATEGORY_ID!,
    category: process.env.GITHUB_COMMENTS_CATEGORY,
    ownerLogins: process.env.GITHUB_COMMENTS_OWNER_LOGIN
      ? [process.env.GITHUB_COMMENTS_OWNER_LOGIN]
      : [],
    readToken: process.env.GITHUB_COMMENTS_READ_TOKEN,
    tokenSecret: tokenSecret(),
    cookieName: COOKIE_NAME,
    pageToUrl: (page) => `https://your-site.com/blog/${page}`,
  });
}

export function commentsOAuth() {
  return createOAuthRoutes({
    clientId: process.env.GITHUB_COMMENTS_CLIENT_ID!,
    clientSecret: process.env.GITHUB_COMMENTS_CLIENT_SECRET!,
    tokenSecret: tokenSecret(),
    cookieName: COOKIE_NAME,
    callbackPath: "/api/comments/oauth/callback",
    defaultReturnPath: "/",
  });
}
