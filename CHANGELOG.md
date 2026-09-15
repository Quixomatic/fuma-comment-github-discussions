# Changelog

All notable changes to fuma-comment-github-discussions are documented here.

## [1.1.0] - 2026-09-14

`@mention` autocomplete.

### Added
- `@mention` support. `storage.queryUsers` now backs fuma-comment's mention autocomplete using GitHub's
  `repository.mentionableUsers(query:)` (exposed as `mentionableUsers` on the low-level client). Enable it
  by passing `mention: { enabled: true }` to both `NextComment` (server) and `<Comments>` (client).
  Posted `@login`s auto-link on GitHub, and `@login` in a comment now renders as a styled mention chip on
  read (conservative detection that ignores emails and mid-word `@`).
- The `examples/nextjs` demo enables mentions.

## [1.0.0] - 2026-09-14

Stable release. Proven in production on getairwave.tv and validated by the runnable demo; the adapter
API is considered stable.

### Added
- A copy-paste "Full setup (Next.js App Router)" guide in the README.
- A runnable `examples/nextjs` demo app (deployable to Vercel) that stands up a comment page against
  any repo + Discussions category you configure.

### Docs
- Documented that `lucide-react` must be installed alongside `@fuma-comment/react` — its widget imports
  icons from it, even though fuma-comment marks it an optional peer (a fresh consumer build fails without
  it).

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
