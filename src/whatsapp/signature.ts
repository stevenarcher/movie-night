import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies the `X-Hub-Signature-256` header that Meta sends with every
 * Cloud API webhook. The signature is `sha256=<hex>` of an HMAC-SHA256 of the
 * raw request body, keyed with the app secret.
 */
export function verifySignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!signature || !signature.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(signature.slice("sha256=".length), "utf8");

  return expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
}