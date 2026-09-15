import { commentsOAuth } from "@/lib/comments";

/** GET /api/comments/oauth/login?return=<url> → start GitHub OAuth. */
export const GET = commentsOAuth().login;
