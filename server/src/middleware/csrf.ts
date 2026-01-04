import type { NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { ApiError } from "../errors.js";
import { config } from "../config.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const CSRF_COOKIE_NAME = "csrf_token";

export function createCsrfToken() {
  return crypto.randomBytes(16).toString("hex");
}

export function ensureCsrfCookie(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    res.cookie(CSRF_COOKIE_NAME, createCsrfToken(), {
      httpOnly: false,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/",
    });
  }
  return next();
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }
  const sessionCookie = req.cookies?.session;
  if (!sessionCookie) {
    return next();
  }
  const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];
  const csrfHeader = req.header("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return next(new ApiError(403, "CSRF", "不正なリクエストです"));
  }
  return next();
}
