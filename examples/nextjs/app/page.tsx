import { CommentSection } from "@/components/comments";
import { commentsEnabled } from "@/lib/comments";

/**
 * The demo page. `page` is the key that maps to one GitHub Discussion (use a post slug/pathname in a
 * real app). The comment thread below is stored as a Discussion on the configured repo + category.
 */
export default function Home() {
  const repo = process.env.GITHUB_COMMENTS_REPO;
  const category = process.env.GITHUB_COMMENTS_CATEGORY;

  return (
    <main className="mx-auto flex min-h-screen max-w-[800px] flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">fuma-comment + GitHub Discussions</h1>
        <p className="text-sm opacity-70">
          A live demo of{" "}
          <a
            href="https://github.com/Quixomatic/fuma-comment-github-discussions"
            className="underline"
          >
            fuma-comment-github-discussions
          </a>
          . Comments below are stored as GitHub Discussions
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
          . Sign in with your GitHub account to post; sign-out and reactions work too.
        </p>
      </header>

      {commentsEnabled() ? (
        <CommentSection page="demo" />
      ) : (
        <p className="text-sm text-red-600">
          Comments are not configured — set the <code>GITHUB_COMMENTS_*</code> environment variables
          (see <code>.env.example</code>).
        </p>
      )}
    </main>
  );
}
