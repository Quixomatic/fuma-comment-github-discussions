# Demo: fuma-comment + GitHub Discussions

A **runnable** Next.js App Router app — a single page whose comment thread is stored in GitHub
Discussions via [`fuma-comment-github-discussions`](../../). Run it locally or deploy it to Vercel as
a live demo. It points at whatever repo + Discussions category you configure.

## What's here

| File | Role |
| --- | --- |
| `lib/comments.ts` | Reads env, builds the adapter + OAuth routes (one place; handlers stay one-liners) |
| `app/api/comments/[...comment]/route.ts` | The comment API (fuma-comment `NextComment` + the adapter) |
| `app/api/comments/oauth/{login,callback,logout}/route.ts` | GitHub sign-in flow |
| `components/comments.tsx` | The client widget (`<Comments>` + a sign-in/out header) |
| `app/page.tsx` | The demo page, mounting the widget for one thread key |
| `app/globals.css` | Tailwind + fuma-comment preset + `@source` |

## Run locally

```bash
pnpm install
cp .env.example .env.local   # then fill it in (see below)
pnpm dev                     # http://localhost:3000
```

### Environment

`.env.local` (these names are this app's convention — the package takes plain values):

- `GITHUB_COMMENTS_CLIENT_ID` / `GITHUB_COMMENTS_CLIENT_SECRET` — a GitHub OAuth App.
- `GITHUB_COMMENTS_TOKEN_SECRET` — any long random string (encrypts the state + cookie).
- `GITHUB_COMMENTS_REPO` / `GITHUB_COMMENTS_REPO_ID` — the public repo + its node id (`R_…`).
- `GITHUB_COMMENTS_CATEGORY` / `GITHUB_COMMENTS_CATEGORY_ID` — the Discussions category name + id (`DIC_…`).
- `GITHUB_COMMENTS_OWNER_LOGIN` — login allowed to moderate.
- `GITHUB_COMMENTS_READ_TOKEN` — a `public_repo` PAT (anonymous reads + opening threads).

Get the ids:
```bash
gh api graphql -f query='{ repository(owner:"you", name:"repo"){ id discussionCategories(first:25){nodes{ id name }} } }'
```

### OAuth callback

Reading comments works immediately. To **sign in / post**, the OAuth App must list the callback URL
for wherever you're running:

- Local: `http://localhost:3000/api/comments/oauth/callback`
- Vercel: `https://<your-deploy>.vercel.app/api/comments/oauth/callback`

Add each to the OAuth App (GitHub → Settings → Developer settings → OAuth Apps → your app → up to 10
callback URLs).

## Deploy to Vercel

1. Push this folder (or point Vercel's **Root Directory** at `examples/nextjs`).
2. Add the `GITHUB_COMMENTS_*` env vars in the Vercel project settings.
3. Add the Vercel URL's `/api/comments/oauth/callback` to the OAuth App (step above).
4. Deploy. The page renders the thread and lets visitors sign in with GitHub and comment.
