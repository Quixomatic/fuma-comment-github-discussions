import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM helper used for the short-lived OAuth `state` and the GitHub token stored in the auth
 * cookie. Key = SHA-256 of the configured secret. Output = base64url of `iv(12) | tag(16) | ciphertext`.
 */

function key(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function decrypt(payload: string, secret: string): string {
  const buf = Buffer.from(payload, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

interface StatePayload {
  r: string;
  e: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function encodeState(returnUrl: string, secret: string): string {
  const payload: StatePayload = { r: returnUrl, e: Date.now() + STATE_TTL_MS };
  return encrypt(JSON.stringify(payload), secret);
}

export function decodeState(state: string, secret: string): string {
  const payload = JSON.parse(decrypt(state, secret)) as StatePayload;
  if (typeof payload.e !== "number" || Date.now() > payload.e) throw new Error("State expired");
  if (typeof payload.r !== "string") throw new Error("Invalid state");
  return payload.r;
}
