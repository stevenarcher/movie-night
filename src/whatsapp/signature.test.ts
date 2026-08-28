import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifySignature } from "./signature";

describe("verifySignature", () => {
  it("accepts a valid HMAC signature", () => {
    const body = JSON.stringify({ hello: "world" });
    const sig =
      "sha256=" + createHmac("sha256", "app_secret").update(body, "utf8").digest("hex");

    expect(verifySignature(body, sig, "app_secret")).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ hello: "world" });
    const sig =
      "sha256=" + createHmac("sha256", "app_secret").update(body, "utf8").digest("hex");

    expect(verifySignature(JSON.stringify({ hello: "evil" }), sig, "app_secret")).toBe(false);
  });

  it("rejects a signature computed with a different secret", () => {
    const body = "payload";
    expect(verifySignature(body, "sha256=".concat("f".repeat(64)), "app_secret")).toBe(false);
  });

  it("rejects malformed signatures", () => {
    expect(verifySignature("payload", "not-a-signature", "secret")).toBe(false);
    expect(verifySignature("payload", null, "secret")).toBe(false);
  });
});