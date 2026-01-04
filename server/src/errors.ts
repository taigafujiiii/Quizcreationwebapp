import type { Response } from "express";

export type ErrorDetails = Record<string, unknown>;

export class ApiError extends Error {
  status: number;
  code: string;
  details: ErrorDetails;

  constructor(status: number, code: string, message: string, details: ErrorDetails = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorResponse(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: ErrorDetails = {}
) {
  return res.status(status).json({
    error: {
      code,
      message,
      details,
    },
  });
}
