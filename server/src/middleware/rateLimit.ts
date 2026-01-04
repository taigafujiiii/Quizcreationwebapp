import rateLimit from "express-rate-limit";
import { config } from "../config.js";

export function createRateLimiter() {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });
}
