import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./secrets";

const originalKey = process.env.ENCRYPTION_KEY;

function freshKey(): string {
  return randomBytes(32).toString("base64");
}

beforeEach(() => {
  process.env.ENCRYPTION_KEY = freshKey();
});

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.ENCRYPTION_KEY;
  } else {
    process.env.ENCRYPTION_KEY = originalKey;
  }
});

describe("secret encryption", () => {
  it("round trips a value", () => {
    const encrypted = encryptSecret("hunter2");
    expect(encrypted.encryptedValue).not.toContain("hunter2");
    expect(decryptSecret(encrypted)).toBe("hunter2");
  });

  it("throws when the auth tag is tampered with", () => {
    const encrypted = encryptSecret("hunter2");
    const tag = Buffer.from(encrypted.authTag, "base64");
    tag[0] = tag[0] ^ 0xff;

    expect(() => decryptSecret({ ...encrypted, authTag: tag.toString("base64") })).toThrow();
  });

  it("throws with the wrong key", () => {
    const encrypted = encryptSecret("hunter2");
    process.env.ENCRYPTION_KEY = freshKey();
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("throws when the key is missing or malformed", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("value")).toThrow(/ENCRYPTION_KEY is not set/);

    process.env.ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encryptSecret("value")).toThrow(/must be 32 bytes/);
  });
});
