import type { AuthAdapter, StorageAdapter } from "@fuma-comment/server";
import type { CustomRequest } from "@fuma-comment/server/custom";

import { createAuth } from "./auth";
import { createGitHubClient } from "./github";
import { createStorage } from "./storage";
import type { GitHubDiscussionsConfig } from "./types";

/**
 * Build the `storage` + `auth` adapters for a GitHub Discussions backend. Spread the result into
 * fuma-comment's `NextComment` (or any framework binding):
 *
 *   const github = githubDiscussions({ repo, repoId, categoryId, category, tokenSecret, ownerLogins, readToken });
 *   export const { GET, POST, PATCH, DELETE } = NextComment({ role: "database", ...github });
 *
 * `role: "database"` routes role lookups through `storage.getRole` so `ownerLogins` can moderate.
 */
export function githubDiscussions(config: GitHubDiscussionsConfig): {
  storage: StorageAdapter;
  auth: AuthAdapter<CustomRequest>;
} {
  const client = createGitHubClient({
    repo: config.repo,
    repoId: config.repoId,
    categoryId: config.categoryId,
    category: config.category,
  });
  return {
    storage: createStorage(config, client),
    auth: createAuth(config, client),
  };
}
