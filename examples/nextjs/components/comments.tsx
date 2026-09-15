"use client";

import { useEffect, useState } from "react";
import { Comments } from "@fuma-comment/react";

/**
 * The comment widget. A client island so the page stays statically rendered: it fetches its own auth
 * state to show "sign in" vs "signed in as …" in the header. Sign-in navigates to the OAuth login route.
 */
export function CommentSection({ page }: { page: string }) {
  const [user, setUser] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/comments/${encodeURIComponent(page)}/auth`)
      .then((r) => (r.ok ? (r.json() as Promise<{ id: string }>) : null))
      .then((data) => active && setUser(data?.id ?? null))
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [page]);

  const here = () => (typeof window !== "undefined" ? window.location.href : "/");
  const signIn = () => {
    window.location.href = `/api/comments/oauth/login?return=${encodeURIComponent(here())}`;
  };
  const signOut = () => {
    window.location.href = `/api/comments/oauth/logout?return=${encodeURIComponent(here())}`;
  };

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-fc-border px-4 py-3">
      <span className="text-sm font-semibold text-fc-foreground">Comments</span>
      {loaded && user ? (
        <span className="flex items-center gap-2 text-xs text-fc-muted-foreground">
          Signed in as <span className="font-medium text-fc-foreground">@{user}</span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md px-2 py-1 font-medium hover:bg-fc-accent"
          >
            Sign out
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={signIn}
          className="rounded-md bg-fc-primary px-3 py-1.5 text-xs font-medium text-fc-primary-foreground"
        >
          Sign in with GitHub
        </button>
      )}
    </div>
  );

  return (
    <Comments
      page={page}
      apiUrl="/api/comments"
      auth={{ type: "api", signIn }}
      mention={{ enabled: true }}
      title={header}
      className="w-full max-w-[800px]"
    />
  );
}
