import { describe, expect, it } from "vitest";
import { hashToken } from "../src/security.js";

describe("hashToken", () => {
  it("creates deterministic hashed token", () => {
    const token = "sample-token";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });
});
