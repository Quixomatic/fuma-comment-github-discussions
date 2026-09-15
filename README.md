# fuma-comment-github-discussions

Store [fuma-comment](https://github.com/fuma-nama/fuma-comment) comments in **GitHub Discussions**.

A `storage` + `auth` adapter for fuma-comment's server, so a fuma-comment UI is backed entirely by
GitHub Discussions on a public repo. Readers sign in with **their own GitHub account** and comment,
reply, and react; each page's thread is one Discussion. GitHub owns the data, moderation, and
spam/auth — **no database, no separate auth system.**

The widget is the themeable, fumadocs-native fuma-comment UI, and the comments live as Discussions in
your own repo.

**Live demo:** https://fuma-comment-github-discussions.vercel.app/

> Extracted from a production integration on [getairwave.tv](https://getairwave.tv). MIT licensed.

## Why

fuma-comment has a great, themeable UI but wants its own database and auth layer. This adapter backs that
UI with GitHub Discussions instead, so GitHub is the store, the moderation, and the identity, and there's
no database to run or auth to build.

## How it works

fuma-comment already separates the **UI** (`@fuma-comment/react`), a **server** with a pluggable
`StorageAdapter` + `AuthAdapter`, and framework bindings (`NextComment`, Hono, Express, …). This package
implements those two adapters against the GitHub Discussions GraphQL API:

- **Storage** → list/post/edit/delete comments as Discussion comments; 👍 / 👎 as reactions; one
  Discussion per page (created on the first comment).
- **Auth** → reads the signed-in reader's GitHub token and returns their login as the session id. Writes
  are made **as that user**, so comments show up under their real GitHub identity and they can edit/delete
  their own; a configurable set of `ownerLogins` can moderate any.
- **Content** → a two-way bridge converts the editor's rich content to Markdown on write and back on read
  (`contentToMarkdown` / `markdownToContent`, exported for reuse).

The reader's token is exchanged server-side and kept in an httpOnly, encrypted cookie — it never reaches
the browser (the fuma-comment UI talks to your same-origin routes, not GitHub directly).

## Prerequisites

1. A **public** GitHub repo with **Discussions enabled**, and a Discussions **category** for comments
   (any open-ended category; not an Announcement-type, which only maintainers can post in).
2. A **GitHub OAuth App** (client id + secret). Its callback URL is your site's
   `/api/comments/oauth/callback` (add every host you serve on, e.g. `www` and apex).
3. The repo's **node id** (`R_…`) and the category's **node id** (`DIC_…`):

   ```bash
   gh api graphql -f query='{ repository(owner:"you", name:"repo"){ id discussionCategories(first:25){nodes{ id name }} } }'
   ```

4. Optionally a **read token** (a classic `public_repo` PAT) for anonymous listing + opening new threads.

## Install

```bash
npm i fuma-comment-github-discussions @fuma-comment/react @fuma-comment/server lucide-react
```

`@fuma-comment/server` is a peer dependency (it provides the adapter interfaces and the framework
binding). `lucide-react` is an optional peer of `@fuma-comment/react`, but its widget imports icons
from it, so install it unless it's already in your app.

## Full setup (Next.js App Router)

Beyond `npm i` and env, this is everything you add — five small files plus a CSS block. A ready-to-copy
version of all of them is in [`examples/nextjs`](./examples/nextjs). The `process.env.*` names below are
arbitrary: **the package takes plain values, not env vars** — source them however you like.

**1. Config glue** — read env once, build the adapter + OAuth routes so the handlers stay one-liners:

```ts
// lib/comments.ts  (server only)
import { githubDiscussions } from "fuma-comment-github-discussions";
import { createOAuthRoutes } from "fuma-comment-github-discussions/next";

const COOKIE_NAME = "gh_comment_token";
const tokenSecret = () => process.env.COMMENTS_TOKEN_SECRET ?? "";

export const commentsEnabled = () =>
  Boolean(process.env.GITHUB_COMMENTS_CLIENT_ID && process.env.GITHUB_COMMENTS_REPO_ID && process.env.GITHUB_COMMENTS_CATEGORY_ID && tokenSecret());

export const commentsAdapter = () =>
  githubDiscussions({
    repo: process.env.GITHUB_COMMENTS_REPO!,               // "owner/name"
    repoId: process.env.GITHUB_COMMENTS_REPO_ID!,          // R_...
    categoryId: process.env.GITHUB_COMMENTS_CATEGORY_ID!,  // DIC_...
    category: process.env.GITHUB_COMMENTS_CATEGORY,        // category NAME (scopes the search)
    ownerLogins: process.env.GITHUB_COMMENTS_OWNER_LOGIN ? [process.env.GITHUB_COMMENTS_OWNER_LOGIN] : [],
    readToken: process.env.GITHUB_COMMENTS_READ_TOKEN,     // anonymous reads + opening threads
    tokenSecret: tokenSecret(),
    cookieName: COOKIE_NAME,
    pageToUrl: (page) => `https://you.dev/blog/${page}`,
  });

export const commentsOAuth = () =>
  createOAuthRoutes({
    clientId: process.env.GITHUB_COMMENTS_CLIENT_ID!,
    clientSecret: process.env.GITHUB_COMMENTS_CLIENT_SECRET!,
    tokenSecret: tokenSecret(),
    cookieName: COOKIE_NAME,
    callbackPath: "/api/comments/oauth/callback",
  });
```

**2. The comment API** — mount fuma-comment's `NextComment` on a catch-all:

```ts
// app/api/comments/[...comment]/route.ts
import { NextComment } from "@fuma-comment/server/next";
import { commentsAdapter } from "@/lib/comments";

export const { GET, POST, PATCH, DELETE } = NextComment({
  role: "database", // route moderation through the adapter's getRole so ownerLogins can delete any
  ...commentsAdapter(),
});
```

> ⚠️ Use the **required** catch-all `[...comment]`, not the optional `[[...comment]]` — Next's route
> validator rejects the optional form against fuma-comment's handler types.

**3. The sign-in routes** — three one-liners (skip if you already have GitHub auth + a token cookie):

```ts
// app/api/comments/oauth/login/route.ts
import { commentsOAuth } from "@/lib/comments";
export const GET = commentsOAuth().login;

// app/api/comments/oauth/callback/route.ts  ->  export const GET = commentsOAuth().callback;
// app/api/comments/oauth/logout/route.ts    ->  export const GET = commentsOAuth().logout;
```

These sit under the same `/api/comments` prefix as the catch-all, but a static route always beats a
catch-all in Next, so there's no conflict.

**4. The widget** — a client component whose sign-in hits the login route:

```tsx
// components/comments.tsx
"use client";
import { Comments } from "@fuma-comment/react";

export function CommentSection({ page }: { page: string }) {
  const signIn = () => {
    window.location.href = `/api/comments/oauth/login?return=${encodeURIComponent(location.href)}`;
  };
  return (
    <div className="comments-theme">
      <Comments page={page} apiUrl="/api/comments" auth={{ type: "api", signIn }} />
    </div>
  );
}
```

Mount it on your page: `{commentsEnabled() ? <CommentSection page={slug} /> : null}`. (See
`examples/nextjs` for a version with a sign-in/sign-out header that keeps the page statically rendered.)

**5. Styles** — load fuma-comment's CSS and theme it. With **Tailwind v4**, use the preset (one build,
one preflight); without Tailwind, import the prebuilt `@fuma-comment/react/style.css` instead.

```css
/* globals.css */
@import "tailwindcss";
@import "@fuma-comment/react/preset.css";
@source "../node_modules/@fuma-comment/react/dist/**/*.js";

/* Theme: override the fc-* variables on your wrapper (map to your own tokens, or set values). */
.comments-theme {
  --color-fc-background: #0b1120;
  --color-fc-foreground: #f1f5f9;
  --color-fc-border: rgba(148, 163, 184, 0.14);
  --color-fc-primary: #4a9fe0;
  --color-fc-primary-foreground: #08111f;
  /* …the rest: fc-muted(-foreground), fc-popover(-foreground), fc-card(-foreground), fc-accent(-foreground), fc-ring */
}
```

> ⚠️ Use the **preset**, not the prebuilt `style.css`, when you already run Tailwind — importing the
> compiled stylesheet adds a second Tailwind preflight that can clobber your site's base styles.

## Config

| Option | Required | Description |
| --- | --- | --- |
| `repo` | ✓ | `"owner/name"` of the public repo storing the discussions |
| `repoId` | ✓ | Repository node id (`R_…`) — needed to open new discussions |
| `categoryId` | ✓ | Discussions category node id (`DIC_…`) new threads open in |
| `category` | – | Category **name**; scopes the search that finds a page's thread (recommended) |
| `tokenSecret` | ✓ | Secret that encrypts the auth cookie + OAuth state (match the OAuth routes) |
| `ownerLogins` | – | GitHub logins allowed to delete/moderate any comment |
| `readToken` | – | Server PAT for anonymous reads + opening threads (Discussions read/write) |
| `pageToTitle` | – | Map a fuma-comment `page` to the Discussion title (default: identity) |
| `pageToUrl` | – | URL placed in a new discussion's seed body |
| `cookieName` | – | Auth cookie name (default `fcgd_token`) |

## Notes & limits

- **One level of replies** — matches both GitHub Discussions and fuma-comment.
- **`readToken` scope** — needs Discussions **read** (anonymous listing) and **write** (opening new
  threads); a classic `public_repo` PAT covers it. Without it, signed-out visitors see no comments and
  own-comment deletes are blocked (author lookup needs a token).
- **Rich content** — bold / italic / strike / inline-code / links / code blocks / images round-trip;
  richer Markdown authored directly on GitHub (headings, lists, quotes) degrades to paragraphs so nothing
  is lost when rendering.
- **Mentions** — `@mention` autocomplete is supported. Opt in by passing `mention: { enabled: true }`
  to `NextComment` (server) **and** to `<Comments>` (client). Suggestions come from GitHub's
  `repository.mentionableUsers(query:)` via the adapter's `queryUsers` (uses `readToken`), and posted
  `@login`s auto-link on GitHub. On display, `@login` in a comment renders as a styled mention.
- **Bring your own auth** — the OAuth routes are a convenience. If you already have the reader's GitHub
  token, set a cookie yourself (or use `readTokenFromCookieHeader`) and skip `/next`.

## License

MIT
