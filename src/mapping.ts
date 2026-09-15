import type { Comment } from "@fuma-comment/server";

import { markdownToContent } from "./content";
import type { GComment, GDiscussion } from "./github";

/**
 * Map GitHub Discussion comments onto fuma-comment's `Comment` shape and do list shaping (thread
 * selection, sort, cursor, limit) in memory. A page's thread is small enough to fetch whole
 * (100 comments x 100 replies) and slice per request.
 */

function reaction(c: GComment, content: "THUMBS_UP" | "THUMBS_DOWN") {
  const g = c.reactionGroups?.find((r) => r.content === content);
  return { count: g?.reactors?.totalCount ?? 0, viewer: g?.viewerHasReacted ?? false };
}

export function mapComment(
  c: GComment,
  page: string,
  opts: { threadId?: string; authed: boolean },
): Comment {
  const up = reaction(c, "THUMBS_UP");
  const down = reaction(c, "THUMBS_DOWN");
  // Only trust viewer reaction flags when the request carried the reader's own token.
  const liked = opts.authed ? (up.viewer ? true : down.viewer ? false : undefined) : undefined;
  return {
    id: c.id,
    threadId: opts.threadId ?? c.replyTo?.id ?? undefined,
    page,
    author: {
      // GitHub login is the stable identity used both here and by the auth adapter, so the UI's
      // author-id === session-id edit/delete gating lines up.
      id: c.author?.login ?? "ghost",
      name: c.author?.login ?? "ghost",
      image: c.author?.avatarUrl,
    },
    content: markdownToContent(c.body),
    likes: up.count,
    dislikes: down.count,
    replies: c.replies?.totalCount ?? 0,
    timestamp: new Date(c.createdAt),
    liked,
  };
}

function visible(c: GComment): boolean {
  return !c.deletedAt && !c.isMinimized;
}

export interface ListParams {
  thread?: string;
  sort: "newest" | "oldest";
  before?: Date;
  after?: Date;
  limit: number;
  authed: boolean;
}

export function buildList(
  discussion: GDiscussion | null,
  page: string,
  params: ListParams,
): Comment[] {
  if (!discussion) return [];
  const top = discussion.comments.nodes.filter(visible);

  let source: Comment[];
  if (params.thread) {
    const parent = top.find((c) => c.id === params.thread);
    source = (parent?.replies?.nodes ?? [])
      .filter(visible)
      .map((r) => mapComment(r, page, { threadId: params.thread, authed: params.authed }));
  } else {
    source = top.map((c) => mapComment(c, page, { authed: params.authed }));
  }

  source.sort((a, b) => {
    const ta = a.timestamp.getTime();
    const tb = b.timestamp.getTime();
    return params.sort === "newest" ? tb - ta : ta - tb;
  });

  if (params.before) source = source.filter((c) => c.timestamp.getTime() < params.before!.getTime());
  if (params.after) source = source.filter((c) => c.timestamp.getTime() > params.after!.getTime());

  return source.slice(0, params.limit);
}
