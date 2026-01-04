import { ApiError } from "../errors.js";

export function assertNotExpired(expiresAt: Date, message: string) {
  if (expiresAt < new Date()) {
    throw new ApiError(410, "TOKEN_EXPIRED", message);
  }
}

export function assertSequenceMatch(expectedQuestionId: number, actualQuestionId: number) {
  if (expectedQuestionId !== actualQuestionId) {
    throw new ApiError(409, "INVALID_SEQUENCE", "回答順序が不正です");
  }
}
