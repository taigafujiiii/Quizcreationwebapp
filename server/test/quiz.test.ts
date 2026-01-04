import { describe, expect, it } from "vitest";
import { assertSequenceMatch } from "../src/services/validation.js";
import { ApiError } from "../src/errors.js";

describe("quiz sequence", () => {
  it("throws 409 when sequence is invalid", () => {
    try {
      assertSequenceMatch(10, 11);
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(409);
      expect(apiError.code).toBe("INVALID_SEQUENCE");
      return;
    }
    throw new Error("Expected error was not thrown");
  });
});
