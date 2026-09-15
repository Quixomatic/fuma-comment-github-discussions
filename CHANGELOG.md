# Changelog

All notable changes to fuma-comment-github-discussions are documented here.

## [0.1.0] - 2026-09-14

Initial release — a GitHub Discussions backend for fuma-comment.

### Added
- `githubDiscussions(config)` — a fuma-comment `storage` + `auth` adapter pair backed by the GitHub
  Discussions GraphQL API, for use with `NextComment` (or any framework binding). One Discussion per
  page (opened on the first comment), comments and one level of replies as Discussion comments, 👍 / 👎
  as reactions, and moderation for a configurable set of `ownerLogins`. Writes are made as the signed-in
  reader (their token is carried on the session), so comments appear under their real GitHub identity.
- `createOAuthRoutes(config)` (from `fuma-comment-github-discussions/next`) — reference GitHub OAuth
  `login` / `callback` / `logout` route handlers for Next.js that keep the user token in an httpOnly,
  AES-256-GCM-encrypted cookie, so it never reaches the browser. Optional: bring your own GitHub auth
  and skip these.
- `contentToMarkdown` / `markdownToContent` — a two-way bridge between the fuma-comment editor's rich
  content (tiptap doc) and GitHub-flavored Markdown, exported for reuse. Unsupported Markdown authored
  directly on GitHub (headings, lists, quotes) degrades to paragraphs so nothing is lost on render.
- Helpers for wiring custom auth: `readTokenFromCookieHeader`, `parseCookies`, `encrypt`, `decrypt`,
  and a low-level `createGitHubClient`.
