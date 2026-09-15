import type { Comment, StorageAdapter } from "@fuma-comment/server";

import { contentToMarkdown } from "./content";
import { createGitHubClient, type GitHubClient } from "./github";
import { buildList, mapComment } from "./mapping";
import { type GitHubAuthInfo, type GitHubDiscussionsConfig, type JSONContent } from "./types";

/**
 * Storage adapter mapping fuma-comment's storage operations onto GitHub Discussions. Writes use the
 * signed-in reader's token (carried on `auth`); anonymous reads and new-thread creation use the
 * configured server `readToken`.
 */

function tokenOf(auth: unknown): string | undefined {
  return (auth as GitHubAuthInfo | undefined)?.token;
}

export function createStorage(config: GitHubDiscussionsConfig, client?: GitHubClient): StorageAdapter {
  const gh =
    client ??
    createGitHubClient({
      repo: config.repo,
      repoId: config.repoId,
      categoryId: config.categoryId,
      category: config.category,
    });
  const titleOf = config.pageToTitle ?? ((p: string) => p);

  async function findOrCreate(page: string, userToken: string): Promise<string> {
    const title = titleOf(page);
    const existing = await gh.findDiscussion(title, userToken);
    if (existing) return existing.id;
    // Open the container with the server/maintainer token when available so a category that restricts
    // who may START a thread still works (any signed-in user can COMMENT on an existing one).
    const createToken = config.readToken || userToken;
    try {
      const created = await gh.createDiscussion(title, config.pageToUrl?.(page), createToken);
      return created.id;
    } catch (err) {
      if (createToken === userToken) throw err;
      const created = await gh.createDiscussion(title, config.pageToUrl?.(page), userToken);
      return created.id;
    }
  }

  return {
    async getComments({ after, before, limit, sort, page, auth, thread }) {
      if (typeof page !== "string") return [];
      const userToken = tokenOf(auth);
      const token = userToken || config.readToken;
      if (!token) return [];
      const discussion = await gh.findDiscussion(titleOf(page), token);
      return buildList(discussion, page, {
        thread,
        sort,
        before,
        after,
        limit,
        authed: Boolean(userToken),
      });
    },

    async postComment({ auth, body, page }): Promise<Comment> {
      const token = tokenOf(auth);
      if (!token) throw new Error("Missing user token");
      const markdown = contentToMarkdown(body.content as JSONContent);
      const discussionId = await findOrCreate(page, token);
      const comment = await gh.addComment(discussionId, markdown, token, body.thread);
      return mapComment(comment, page, { threadId: body.thread, authed: true });
    },

    async updateComment({ id, auth, body }) {
      const token = tokenOf(auth);
      if (!token) throw new Error("Missing user token");
      await gh.updateComment(id, contentToMarkdown(body.content as JSONContent), token);
    },

    async deleteComment({ id, auth }) {
      const token = tokenOf(auth);
      if (!token) throw new Error("Missing user token");
      await gh.deleteComment(id, token);
    },

    async setRate({ id, auth, body }) {
      const token = tokenOf(auth);
      if (!token) throw new Error("Missing user token");
      const state = await gh.getViewerReactions(id, token);
      if (body.like) {
        if (!state.up) await gh.setReaction(id, "THUMBS_UP", "add", token);
        if (state.down) await gh.setReaction(id, "THUMBS_DOWN", "remove", token);
      } else {
        if (!state.down) await gh.setReaction(id, "THUMBS_DOWN", "add", token);
        if (state.up) await gh.setReaction(id, "THUMBS_UP", "remove", token);
      }
    },

    async deleteRate({ id, auth }) {
      const token = tokenOf(auth);
      if (!token) throw new Error("Missing user token");
      const state = await gh.getViewerReactions(id, token);
      if (state.up) await gh.setReaction(id, "THUMBS_UP", "remove", token);
      if (state.down) await gh.setReaction(id, "THUMBS_DOWN", "remove", token);
    },

    async getCommentAuthor({ id }) {
      // Called before delete to gate ownership; needs a token but receives no auth, so use readToken.
      if (!config.readToken) return null;
      return gh.getCommentAuthor(id, config.readToken);
    },

    async getRole({ auth, page: _page }) {
      const owners = (config.ownerLogins ?? []).map((l) => l.toLowerCase());
      const isOwner = owners.includes(auth.id.toLowerCase());
      return isOwner ? { name: "maintainer", canDelete: true } : null;
    },
  };
}
