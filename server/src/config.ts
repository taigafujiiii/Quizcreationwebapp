import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_ISSUER: z.string().default("quiz-app"),
  SESSION_TTL_HOURS: z.string().optional(),
  TOKEN_PEPPER: z.string().min(8),
  APP_BASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().optional(),
  COOKIE_SECURE: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["resend", "sendgrid", "console"]).optional(),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().optional(),
  RATE_LIMIT_MAX: z.string().optional(),
  QUIZ_ATTEMPT_TTL_HOURS: z.string().optional(),
  INVITE_TTL_HOURS: z.string().optional(),
  VERIFY_EMAIL_TTL_HOURS: z.string().optional(),
  RESET_PASSWORD_TTL_HOURS: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

export const config = {
  nodeEnv: parsed.NODE_ENV ?? "development",
  port: Number(parsed.PORT ?? 4000),
  databaseUrl: parsed.DATABASE_URL,
  jwtSecret: parsed.JWT_SECRET,
  jwtIssuer: parsed.JWT_ISSUER,
  sessionTtlHours: Number(parsed.SESSION_TTL_HOURS ?? 168),
  tokenPepper: parsed.TOKEN_PEPPER,
  appBaseUrl: parsed.APP_BASE_URL,
  frontendOrigin: parsed.FRONTEND_ORIGIN ?? "http://localhost:5173",
  cookieSecure: parsed.COOKIE_SECURE === "true",
  emailProvider: parsed.EMAIL_PROVIDER ?? "console",
  emailFrom: parsed.EMAIL_FROM ?? "no-reply@example.com",
  resendApiKey: parsed.RESEND_API_KEY,
  sendgridApiKey: parsed.SENDGRID_API_KEY,
  rateLimitWindowMs: Number(parsed.RATE_LIMIT_WINDOW_MS ?? 10 * 60 * 1000),
  rateLimitMax: Number(parsed.RATE_LIMIT_MAX ?? 10),
  quizAttemptTtlHours: Number(parsed.QUIZ_ATTEMPT_TTL_HOURS ?? 24),
  inviteTtlHours: Number(parsed.INVITE_TTL_HOURS ?? 48),
  verifyEmailTtlHours: Number(parsed.VERIFY_EMAIL_TTL_HOURS ?? 24),
  resetPasswordTtlHours: Number(parsed.RESET_PASSWORD_TTL_HOURS ?? 1),
};
