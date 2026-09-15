import { CommentSection } from "@/components/comments";
import { commentsEnabled } from "@/lib/comments";

/**
 * The demo page. `page` is the key that maps to one GitHub Discussion (use a post slug/pathname in a
 * real app). The comment thread below is stored as a Discussion on the configured repo + category.
 */
const LINKS = [
  { label: "npm package", href: "https://www.npmjs.com/package/fuma-comment-github-discussions" },
  { label: "GitHub repo", href: "https://github.com/Quixomatic/fuma-comment-github-discussions" },
  { label: "fuma-comment", href: "https://github.com/fuma-nama/fuma-comment" },
  {
    label: "See the discussion on GitHub →",
    href: "https://github.com/Quixomatic/fuma-comment-github-discussions/discussions/1",
  },
];

export default function Home() {
  const repo = process.env.GITHUB_COMMENTS_REPO;
  const category = process.env.GITHUB_COMMENTS_CATEGORY;

  return (
    <main className="mx-auto flex min-h-screen max-w-[800px] flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">fuma-comment + GitHub Discussions</h1>
        <p className="text-sm opacity-70">
          A live demo of the <code>fuma-comment-github-discussions</code> adapter. The comments below are
          stored as GitHub Discussions
          {repo ? (
            <>
              {" "}
              on <code>{repo}</code>
            </>
          ) : null}
          {category ? (
            <>
              {" "}
              in <strong>{category}</strong>
            </>
          ) : null}
          . Sign in with your GitHub account to post; replies and 👍 / 👎 reactions work too. Whatever you
          post here shows up on the linked GitHub discussion, and vice versa.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 opacity-80 hover:opacity-100"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </header>

      {commentsEnabled() ? (
        <CommentSection page="demo" />
      ) : (
        <p className="text-sm text-red-600">
          Comments are not configured. Set the <code>GITHUB_COMMENTS_*</code> environment variables.
        </p>
      )}
    </main>
  );
}
