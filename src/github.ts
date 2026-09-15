/**
 * GitHub Discussions GraphQL client. Every call takes an explicit token: the signed-in reader's OAuth
 * token for writes and viewer-scoped reads, or the configured server token for anonymous listing.
 * Fetches raw `body` Markdown (not `bodyHTML`) so the content bridge can rebuild the editor doc.
 */

export const GITHUB_GRAPHQL = "https://api.github.com/graphql";

export interface GReactionGroup {
  content: string;
  reactors?: { totalCount: number };
  viewerHasReacted: boolean;
}

export interface GAuthor {
  login: string;
  avatarUrl: string;
  url: string;
}

export interface GComment {
  id: string;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  isMinimized: boolean;
  author: GAuthor | null;
  reactionGroups: GReactionGroup[];
  replyTo?: { id: string } | null;
  replies?: { totalCount: number; nodes: GComment[] };
}

export interface GDiscussion {
  id: string;
  title: string;
  url: string;
  locked: boolean;
  comments: { totalCount: number; nodes: GComment[] };
}

async function gql<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  const res = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "fuma-comment-github-discussions",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("GitHub GraphQL: empty response");
  return json.data;
}

const COMMENT_FIELDS = /* GraphQL */ `
  id
  body
  createdAt
  deletedAt
  isMinimized
  author { login avatarUrl url }
  reactionGroups { content viewerHasReacted reactors { totalCount } }
`;

const DISCUSSION_FIELDS = /* GraphQL */ `
  id
  title
  url
  locked
  comments(first: 100) {
    totalCount
    nodes {
      ${COMMENT_FIELDS}
      replies(first: 100) {
        totalCount
        nodes { ${COMMENT_FIELDS} replyTo { id } }
      }
    }
  }
`;

const SEARCH_QUERY = /* GraphQL */ `
  query ($query: String!) {
    search(type: DISCUSSION, first: 10, query: $query) {
      nodes { ... on Discussion { ${DISCUSSION_FIELDS} } }
    }
  }
`;

const CREATE_DISCUSSION = /* GraphQL */ `
  mutation ($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(
      input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }
    ) { discussion { ${DISCUSSION_FIELDS} } }
  }
`;

const ADD_COMMENT = /* GraphQL */ `
  mutation ($discussionId: ID!, $body: String!, $replyToId: ID) {
    addDiscussionComment(input: { discussionId: $discussionId, body: $body, replyToId: $replyToId }) {
      comment {
        ${COMMENT_FIELDS}
        replyTo { id }
        replies(first: 100) { totalCount nodes { id } }
      }
    }
  }
`;

const UPDATE_COMMENT = /* GraphQL */ `
  mutation ($commentId: ID!, $body: String!) {
    updateDiscussionComment(input: { commentId: $commentId, body: $body }) { comment { id } }
  }
`;

const DELETE_COMMENT = /* GraphQL */ `
  mutation ($id: ID!) {
    deleteDiscussionComment(input: { id: $id }) { comment { id } }
  }
`;

const REACTION = (mode: "add" | "remove") => /* GraphQL */ `
  mutation ($subjectId: ID!, $content: ReactionContent!) {
    ${mode}Reaction(input: { subjectId: $subjectId, content: $content }) { clientMutationId }
  }
`;

const VIEWER_QUERY = /* GraphQL */ `query { viewer { login } }`;

const VIEWER_REACTIONS = /* GraphQL */ `
  query ($id: ID!) {
    node(id: $id) {
      ... on DiscussionComment { reactionGroups { content viewerHasReacted } }
    }
  }
`;

const COMMENT_AUTHOR = /* GraphQL */ `
  query ($id: ID!) {
    node(id: $id) { ... on DiscussionComment { author { login } } }
  }
`;

const MENTIONABLE_USERS = /* GraphQL */ `
  query ($owner: String!, $name: String!, $query: String!, $first: Int!) {
    repository(owner: $owner, name: $name) {
      mentionableUsers(first: $first, query: $query) {
        nodes { login name avatarUrl }
      }
    }
  }
`;

export interface GMentionableUser {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export type ReactionContent = "THUMBS_UP" | "THUMBS_DOWN";

export function createGitHubClient(cfg: {
  repo: string;
  repoId: string;
  categoryId: string;
  category?: string;
}) {
  const [owner = "", name = ""] = cfg.repo.split("/");
  /** Find the discussion whose title exactly equals `term` (search is fuzzy, so match exactly). */
  async function findDiscussion(term: string, token: string): Promise<GDiscussion | null> {
    const repo = cfg.repo.toLowerCase();
    const categoryQuery = cfg.category ? `category:${JSON.stringify(cfg.category)}` : "";
    const query = `repo:${repo} ${categoryQuery} in:title ${JSON.stringify(term)}`;
    const data = await gql<{ search: { nodes: (GDiscussion | Record<string, never>)[] } }>(
      SEARCH_QUERY,
      { query },
      token,
    );
    return data.search.nodes.find((n): n is GDiscussion => "title" in n && n.title === term) ?? null;
  }

  async function createDiscussion(title: string, url: string | undefined, token: string): Promise<GDiscussion> {
    const link = url ? ` ([${title}](${url}))` : "";
    const body = `Comment thread for${link ? "" : " page"} \`${title}\`${link}.\n\nManaged by fuma-comment.`;
    const data = await gql<{ createDiscussion: { discussion: GDiscussion } }>(
      CREATE_DISCUSSION,
      { repositoryId: cfg.repoId, categoryId: cfg.categoryId, title, body },
      token,
    );
    return data.createDiscussion.discussion;
  }

  async function addComment(
    discussionId: string,
    body: string,
    token: string,
    replyToId?: string,
  ): Promise<GComment> {
    const data = await gql<{ addDiscussionComment: { comment: GComment } }>(
      ADD_COMMENT,
      { discussionId, body, replyToId: replyToId ?? null },
      token,
    );
    return data.addDiscussionComment.comment;
  }

  async function updateComment(commentId: string, body: string, token: string): Promise<void> {
    await gql(UPDATE_COMMENT, { commentId, body }, token);
  }

  async function deleteComment(commentId: string, token: string): Promise<void> {
    await gql(DELETE_COMMENT, { id: commentId }, token);
  }

  async function setReaction(
    subjectId: string,
    content: ReactionContent,
    mode: "add" | "remove",
    token: string,
  ): Promise<void> {
    await gql(REACTION(mode), { subjectId, content }, token);
  }

  async function getViewerLogin(token: string): Promise<string | null> {
    const data = await gql<{ viewer: { login: string } | null }>(VIEWER_QUERY, {}, token);
    return data.viewer?.login ?? null;
  }

  async function getViewerReactions(
    commentId: string,
    token: string,
  ): Promise<{ up: boolean; down: boolean }> {
    const data = await gql<{
      node: { reactionGroups?: { content: string; viewerHasReacted: boolean }[] } | null;
    }>(VIEWER_REACTIONS, { id: commentId }, token);
    const groups = data.node?.reactionGroups ?? [];
    const has = (c: string) => groups.find((g) => g.content === c)?.viewerHasReacted ?? false;
    return { up: has("THUMBS_UP"), down: has("THUMBS_DOWN") };
  }

  async function getCommentAuthor(commentId: string, token: string): Promise<string | null> {
    const data = await gql<{ node: { author?: { login: string } | null } | null }>(
      COMMENT_AUTHOR,
      { id: commentId },
      token,
    );
    return data.node?.author?.login ?? null;
  }

  /** Users mentionable in the repo (collaborators + participants) matching `query` — for @mention autocomplete. */
  async function mentionableUsers(
    query: string,
    first: number,
    token: string,
  ): Promise<GMentionableUser[]> {
    const data = await gql<{ repository: { mentionableUsers: { nodes: GMentionableUser[] } } | null }>(
      MENTIONABLE_USERS,
      { owner, name, query, first },
      token,
    );
    return data.repository?.mentionableUsers.nodes ?? [];
  }

  return {
    findDiscussion,
    createDiscussion,
    addComment,
    updateComment,
    deleteComment,
    setReaction,
    getViewerLogin,
    getViewerReactions,
    getCommentAuthor,
    mentionableUsers,
  };
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;
