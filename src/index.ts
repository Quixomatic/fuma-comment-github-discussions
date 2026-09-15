/**
 * fuma-comment-github-discussions — store fuma-comment comments in GitHub Discussions.
 *
 * Core (framework-agnostic) entry. The Next OAuth reference routes live in the `/next` entry.
 */

export { githubDiscussions } from "./adapter";
export { createStorage } from "./storage";
export { createAuth } from "./auth";
export { createGitHubClient } from "./github";
export type { GitHubClient, GComment, GDiscussion, ReactionContent } from "./github";

// The reusable content bridge (tiptap doc <-> Markdown), also useful on its own.
export { contentToMarkdown, markdownToContent } from "./content";

// Cookie/token helpers, for wiring a custom `getToken` or your own auth.
export { readTokenFromCookieHeader, parseCookies } from "./oauth/cookie";
export { encrypt, decrypt } from "./oauth/crypto";

export type { GitHubDiscussionsConfig, GitHubAuthInfo, JSONContent } from "./types";
export { DEFAULT_COOKIE } from "./types";
