import type { AuthInfo } from "@fuma-comment/server";

/** A tiptap/ProseMirror content node — what the fuma-comment editor emits and its renderer consumes. */
export interface JSONContent {
  type?: string;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
}

/**
 * fuma-comment's `AuthInfo` carries only `{ id }`, but this backend needs the signed-in reader's
 * GitHub token to act as them. fuma-comment passes the exact object returned by the auth adapter's
 * `getSession` through to every storage method, so we attach the token here and read it back in
 * storage. (`id` is the GitHub login, which the storage also uses as the comment author id.)
 */
export interface GitHubAuthInfo extends AuthInfo {
  token: string;
}

export interface GitHubDiscussionsConfig {
  /** "owner/name" of the PUBLIC repo whose Discussions store the comments. */
  repo: string;
  /** Repository node id (`R_...`), required to open new discussions. */
  repoId: string;
  /** Discussions category node id (`DIC_...`) new per-page threads are opened in. */
  categoryId: string;
  /** Category NAME — scopes the search that finds a page's discussion. Recommended. */
  category?: string;
  /** GitHub logins allowed to moderate (delete/edit any comment). */
  ownerLogins?: string[];
  /**
   * A server token (GitHub PAT) used for anonymous reads and to open new threads. Needs Discussions
   * read + write on the repo (a classic `public_repo` PAT works). Without it, signed-out visitors see
   * no comments and own-comment deletes are blocked (author lookup needs a token).
   */
  readToken?: string;
  /** Map a fuma-comment `page` to the Discussion title (one discussion per page). Default: identity. */
  pageToTitle?: (page: string) => string;
  /** URL placed in a new discussion's seed body. Default: none. */
  pageToUrl?: (page: string) => string;
  /** Secret that decrypts the auth cookie — must match the OAuth routes' `tokenSecret`. */
  tokenSecret: string;
  /** Name of the cookie holding the encrypted user token. Default: `fcgd_token`. */
  cookieName?: string;
}

export const DEFAULT_COOKIE = "fcgd_token";
