import { NextComment } from "@fuma-comment/server/next";

import { commentsAdapter } from "@/lib/comments";

/**
 * The comment API. fuma-comment's Next binding wired to the GitHub Discussions adapter. Handles list,
 * post, edit, delete, reactions, and the auth check under `/api/comments/*`.
 *
 * NOTE: must be the REQUIRED catch-all `[...comment]`, not the optional `[[...comment]]` — Next's route
 * validator rejects the optional form against fuma-comment's handler types.
 */
export const { GET, POST, PATCH, DELETE } = NextComment({
  role: "database", // route moderation through the adapter's getRole so ownerLogins can delete any
  ...commentsAdapter(),
});
