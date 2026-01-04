import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { ApiError } from "../errors.js";
import { verifySession } from "../session.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token) {
    return next(new ApiError(401, "UNAUTHORIZED", "ログインが必要です"));
  }
  try {
    const payload = verifySession(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, isActive: true },
    });
    if (!user || !user.isActive) {
      return next(new ApiError(401, "UNAUTHORIZED", "ログインが必要です"));
    }
    req.user = { id: user.id, role: user.role, email: user.email };
    return next();
  } catch {
    return next(new ApiError(401, "UNAUTHORIZED", "ログインが必要です"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ApiError(401, "UNAUTHORIZED", "ログインが必要です"));
  }
  if (req.user.role !== "ADMIN") {
    return next(new ApiError(403, "FORBIDDEN", "権限がありません"));
  }
  return next();
}
