import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { ZodError } from "zod";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import quizRoutes from "./routes/quiz.js";
import { config } from "./config.js";
import { ApiError, errorResponse } from "./errors.js";
import { ensureCsrfCookie, csrfProtection } from "./middleware/csrf.js";
import { createRateLimiter } from "./middleware/rateLimit.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(ensureCsrfCookie);
  app.use(csrfProtection);

  const limiter = createRateLimiter();

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", limiter, authRoutes);
  app.use("/api/admin", limiter, adminRoutes);
  app.use("/api/quiz", quizRoutes);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ApiError) {
      return errorResponse(res, err.status, err.code, err.message, err.details);
    }
    if (err instanceof ZodError) {
      return errorResponse(res, 400, "INVALID_INPUT", "入力が不正です", {
        issues: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      });
    }
    console.error(err);
    return errorResponse(res, 500, "INTERNAL_ERROR", "サーバーエラーが発生しました");
  });

  return app;
}
