import { describe, expect, it } from "vitest";
import { assertNotExpired } from "../src/services/validation.js";
import { ApiError } from "../src/errors.js";

describe("invite expiration", () => {
  it("throws 410 when invite is expired", () => {
    try {
      assertNotExpired(new Date(Date.now() - 1000), "招待の有効期限が切れています");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(410);
      expect(apiError.code).toBe("TOKEN_EXPIRED");
      return;
    }
    throw new Error("Expected error was not thrown");
  });
});
