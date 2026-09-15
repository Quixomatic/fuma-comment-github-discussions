# fuma-comment-github-discussions

Store [fuma-comment](https://github.com/fuma-nama/fuma-comment) comments in **GitHub Discussions**.

A `storage` + `auth` adapter for fuma-comment's server, so a fuma-comment UI is backed entirely by
GitHub Discussions on a public repo. Readers sign in with **their own GitHub account** and comment,
reply, and react; each page's thread is one Discussion. GitHub owns the data, moderation, and
spam/auth — **no database, no separate auth system.**

Think of it as *giscus's backend with fuma-comment's UI*: the modern, themeable, fumadocs-native
widget instead of an iframe, but the comments still live in your repo's Discussions.

> Extracted from a production integration on [getairwave.tv](https://getairwave.tv). MIT licensed.

## Why

- **Plain giscus** does the GitHub-Discussions-as-comments job, but its UI is an iframe you can't theme.
- **Plain fuma-comment** has a great, themeable UI, but wants its own database + auth layer.
- **This** drives fuma-comment's UI with a GitHub Discussions storage adapter: the look of the former,
  the store/moderation/identity of the latter.

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
npm i fuma-comment-github-discussions @fuma-comment/react @fuma-comment/server
```

`@fuma-comment/server` is a peer dependency (it provides the adapter interfaces and the framework binding).

## Usage (Next.js App Router)

**1. The comment API** — mount fuma-comment's `NextComment` on a catch-all and spread in the adapter:

```ts
// app/api/comments/[[...comment]]/route.ts
import { NextComment } from "@fuma-comment/server/next";
import { githubDiscussions } from "fuma-comment-github-discussions";

export const { GET, POST, PATCH, DELETE } = NextComment({
  role: "database", // route role lookups through storage.getRole so ownerLogins can moderate
  ...githubDiscussions({
    repo: "you/repo",
    repoId: process.env.GH_REPO_ID!,        // R_...
    categoryId: process.env.GH_CATEGORY_ID!, // DIC_...
    category: "Blog Posts",                  // category NAME (scopes the search)
    ownerLogins: ["you"],                    // may delete any comment
    readToken: process.env.GH_READ_TOKEN,    // anonymous reads + new threads
    tokenSecret: process.env.COMMENTS_SECRET!, // must match the OAuth routes
    pageToUrl: (page) => `https://you.dev/blog/${page}`,
  }),
});
```

**2. The sign-in flow** — the optional reference OAuth routes (skip these if you already have GitHub auth;
just provide your own cookie and point `tokenSecret`/`cookieName` at it):

```ts
// app/api/comments/oauth/login/route.ts   (and callback/route.ts, logout/route.ts)
import { createOAuthRoutes } from "fuma-comment-github-discussions/next";

const oauth = createOAuthRoutes({
  clientId: process.env.GH_CLIENT_ID!,
  clientSecret: process.env.GH_CLIENT_SECRET!,
  tokenSecret: process.env.COMMENTS_SECRET!,
  callbackPath: "/api/comments/oauth/callback",
});

export const GET = oauth.login; // in callback/route.ts use oauth.callback; in logout/route.ts oauth.logout
```

These sit under the same `/api/comments` prefix as the catch-all, but a static route
(`oauth/login`) always beats a catch-all in Next, so there's no conflict.

**3. The widget** — a client component, with a sign-in that hits the login route:

```tsx
"use client";
import { Comments } from "@fuma-comment/react";
import "@fuma-comment/react/style.css";

export function BlogComments({ slug }: { slug: string }) {
  const signIn = () => {
    window.location.href = `/api/comments/oauth/login?return=${encodeURIComponent(location.href)}`;
  };
  return <Comments page={slug} apiUrl="/api/comments" auth={{ type: "api", signIn }} />;
}
```

Theme it by overriding fuma-comment's `--color-fc-*` CSS variables on a wrapper.

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
- **Mentions** — the mention autocomplete is not wired (GitHub has no cheap "users on this thread" query);
  typing `@name` still posts and GitHub auto-links real users.
- **Bring your own auth** — the OAuth routes are a convenience. If you already have the reader's GitHub
  token, set a cookie yourself (or use `readTokenFromCookieHeader`) and skip `/next`.

## License

MIT
