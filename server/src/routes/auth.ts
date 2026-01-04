import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { ApiError } from "../errors.js";
import { config } from "../config.js";
import { asyncHandler } from "../utils.js";
import { generateToken, hashPassword, hashToken, verifyPassword } from "../security.js";
import { sendEmail } from "../services/email.js";
import { signSession } from "../session.js";
import { createCsrfToken, CSRF_COOKIE_NAME } from "../middleware/csrf.js";
import { assertNotExpired } from "../services/validation.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password } = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError(400, "EMAIL_EXISTS", "既に登録済みのメールアドレスです");
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "USER",
      },
    });
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.verifyEmailTtlHours * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const existingToken = await tx.authToken.findFirst({
        where: { userId: user.id, type: "VERIFY_EMAIL", usedAt: null },
      });
      if (existingToken) {
        await tx.authToken.update({
          where: { id: existingToken.id },
          data: { tokenHash, expiresAt, createdAt: new Date(), usedAt: null },
        });
      } else {
        await tx.authToken.create({
          data: { userId: user.id, type: "VERIFY_EMAIL", tokenHash, expiresAt },
        });
      }
    });

    const verifyUrl = `${config.appBaseUrl}/verify?token=${token}`;
    await sendEmail({
      to: email,
      subject: "メール認証のご案内",
      text: `以下のリンクからメール認証を完了してください。\n${verifyUrl}`,
    });

    res.json({ ok: true });
  })
);

const verifySchema = z.object({ token: z.string().min(10) });

router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const { token } = verifySchema.parse(req.body);
    const tokenHash = hashToken(token);
    const authToken = await prisma.authToken.findFirst({
      where: { tokenHash, type: "VERIFY_EMAIL", usedAt: null },
      include: { user: true },
    });
    if (!authToken) {
      throw new ApiError(400, "INVALID_TOKEN", "トークンが無効です");
    }
    assertNotExpired(authToken.expiresAt, "トークンの有効期限が切れています");

    await prisma.$transaction(async (tx) => {
      await tx.authToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: authToken.userId },
        data: { emailVerifiedAt: new Date() },
      });
    });

    res.json({ ok: true });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "メールアドレスまたはパスワードが違います");
    }
    if (!user.isActive) {
      throw new ApiError(403, "ACCOUNT_INACTIVE", "アカウントが無効です");
    }
    if (!user.emailVerifiedAt) {
      throw new ApiError(401, "EMAIL_NOT_VERIFIED", "メール認証が完了していません");
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "メールアドレスまたはパスワードが違います");
    }
    const token = signSession({ sub: user.id, role: user.role });
    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
      maxAge: config.sessionTtlHours * 60 * 60 * 1000,
      path: "/",
    });
    res.cookie(CSRF_COOKIE_NAME, createCsrfToken(), {
      httpOnly: false,
      sameSite: "lax",
      secure: config.cookieSecure,
      path: "/",
    });
    res.json({
      user: { id: user.id, email: user.email, role: user.role },
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    res.clearCookie("session", { path: "/" });
    res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  })
);

const forgotSchema = z.object({ email: z.string().email() });

router.post(
  "/forgot",
  asyncHandler(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + config.resetPasswordTtlHours * 60 * 60 * 1000);

      await prisma.$transaction(async (tx) => {
        const existingToken = await tx.authToken.findFirst({
          where: { userId: user.id, type: "RESET_PASSWORD", usedAt: null },
        });
        if (existingToken) {
          await tx.authToken.update({
            where: { id: existingToken.id },
            data: { tokenHash, expiresAt, createdAt: new Date(), usedAt: null },
          });
        } else {
          await tx.authToken.create({
            data: { userId: user.id, type: "RESET_PASSWORD", tokenHash, expiresAt },
          });
        }
      });

      const resetUrl = `${config.appBaseUrl}/reset?token=${token}`;
      await sendEmail({
        to: email,
        subject: "パスワード再設定のご案内",
        text: `以下のリンクからパスワードを再設定してください。\n${resetUrl}`,
      });
    }

    res.json({ ok: true });
  })
);

const resetSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

router.post(
  "/reset",
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetSchema.parse(req.body);
    const tokenHash = hashToken(token);
    const authToken = await prisma.authToken.findFirst({
      where: { tokenHash, type: "RESET_PASSWORD", usedAt: null },
    });
    if (!authToken) {
      throw new ApiError(400, "INVALID_TOKEN", "トークンが無効です");
    }
    assertNotExpired(authToken.expiresAt, "トークンの有効期限が切れています");

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: authToken.userId },
        data: { passwordHash },
      });
      await tx.authToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() },
      });
    });

    res.json({ ok: true });
  })
);

export default router;
