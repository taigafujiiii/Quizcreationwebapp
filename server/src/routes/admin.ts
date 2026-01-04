import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../utils.js";
import { generateToken, hashPassword, hashToken } from "../security.js";
import { config } from "../config.js";
import { sendEmail } from "../services/email.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { assertNotExpired } from "../services/validation.js";

const router = Router();

const inviteSchema = z.object({ email: z.string().email() });

const acceptInviteSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8),
});

router.post(
  "/invites/accept",
  asyncHandler(async (req, res) => {
    const { token, password } = acceptInviteSchema.parse(req.body);
    const tokenHash = hashToken(token);
    const invite = await prisma.adminInvite.findFirst({
      where: { tokenHash, usedAt: null },
    });
    if (!invite) {
      throw new ApiError(400, "INVALID_TOKEN", "トークンが無効です");
    }
    assertNotExpired(invite.expiresAt, "招待の有効期限が切れています");
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      throw new ApiError(400, "EMAIL_EXISTS", "既にユーザーが存在します");
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: invite.email,
          passwordHash,
          role: "ADMIN",
          emailVerifiedAt: new Date(),
        },
      });
      await tx.adminInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
    });

    res.json({ ok: true });
  })
);

router.use(requireAuth, requireAdmin);

router.post(
  "/invites",
  asyncHandler(async (req, res) => {
    const { email } = inviteSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ApiError(400, "EMAIL_EXISTS", "既にユーザーが存在します");
    }
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.inviteTtlHours * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const existingInvite = await tx.adminInvite.findFirst({
        where: { email, usedAt: null },
      });
      if (existingInvite) {
        await tx.adminInvite.update({
          where: { id: existingInvite.id },
          data: { tokenHash, expiresAt, createdAt: new Date(), invitedBy: req.user!.id, usedAt: null },
        });
      } else {
        await tx.adminInvite.create({
          data: { email, tokenHash, expiresAt, invitedBy: req.user!.id },
        });
      }
    });

    const inviteUrl = `${config.appBaseUrl}/admin/invite?token=${token}`;
    await sendEmail({
      to: email,
      subject: "管理者招待のご案内",
      text: `以下のリンクから管理者登録を完了してください。\n${inviteUrl}`,
    });

    res.json({ ok: true });
  })
);

const unitSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int(),
});

router.get(
  "/units",
  asyncHandler(async (_req, res) => {
    const units = await prisma.unit.findMany({ orderBy: { sortOrder: "asc" } });
    res.json({ units });
  })
);

router.post(
  "/units",
  asyncHandler(async (req, res) => {
    const payload = unitSchema.parse(req.body);
    const unit = await prisma.unit.create({ data: payload });
    res.json({ unit });
  })
);

router.put(
  "/units",
  asyncHandler(async (req, res) => {
    const payload = unitSchema.extend({ id: z.number().int() }).parse(req.body);
    const unit = await prisma.unit.update({
      where: { id: payload.id },
      data: { name: payload.name, sortOrder: payload.sortOrder },
    });
    res.json({ unit });
  })
);

router.delete(
  "/units",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.number().int() }).parse(req.body);
    await prisma.unit.delete({ where: { id } });
    res.json({ ok: true });
  })
);

const categorySchema = z.object({
  unitId: z.number().int(),
  name: z.string().min(1),
  sortOrder: z.number().int(),
});

router.get(
  "/categories",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({ orderBy: [{ unitId: "asc" }, { sortOrder: "asc" }] });
    res.json({ categories });
  })
);

router.post(
  "/categories",
  asyncHandler(async (req, res) => {
    const payload = categorySchema.parse(req.body);
    const category = await prisma.category.create({ data: payload });
    res.json({ category });
  })
);

router.put(
  "/categories",
  asyncHandler(async (req, res) => {
    const payload = categorySchema.extend({ id: z.number().int() }).parse(req.body);
    const category = await prisma.category.update({
      where: { id: payload.id },
      data: { unitId: payload.unitId, name: payload.name, sortOrder: payload.sortOrder },
    });
    res.json({ category });
  })
);

router.delete(
  "/categories",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.number().int() }).parse(req.body);
    await prisma.category.delete({ where: { id } });
    res.json({ ok: true });
  })
);

const choiceSchema = z.object({
  label: z.enum(["A", "B", "C", "D"]),
  body: z.string().min(1),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  categoryId: z.number().int(),
  body: z.string().min(1),
  explanation: z.string().min(1),
  isActive: z.boolean().optional(),
  choices: z.array(choiceSchema).length(4),
});

function validateChoices(choices: Array<{ label: string; isCorrect: boolean }>) {
  const labels = new Set(choices.map((choice) => choice.label));
  if (labels.size !== 4) {
    throw new ApiError(400, "INVALID_CHOICES", "選択肢はA〜Dを重複なく指定してください");
  }
  const correctCount = choices.filter((choice) => choice.isCorrect).length;
  if (correctCount !== 1) {
    throw new ApiError(400, "INVALID_CHOICES", "正解は1つだけ指定してください");
  }
}

router.get(
  "/questions",
  asyncHandler(async (_req, res) => {
    const questions = await prisma.question.findMany({
      include: { choices: true },
      orderBy: { id: "asc" },
    });
    res.json({ questions });
  })
);

router.post(
  "/questions",
  asyncHandler(async (req, res) => {
    const payload = questionSchema.parse(req.body);
    validateChoices(payload.choices);
    const question = await prisma.question.create({
      data: {
        categoryId: payload.categoryId,
        body: payload.body,
        explanation: payload.explanation,
        isActive: payload.isActive ?? true,
        createdBy: req.user!.id,
        choices: {
          create: payload.choices.map((choice) => ({
            label: choice.label,
            body: choice.body,
            isCorrect: choice.isCorrect,
          })),
        },
      },
      include: { choices: true },
    });
    res.json({ question });
  })
);

router.put(
  "/questions",
  asyncHandler(async (req, res) => {
    const payload = questionSchema.extend({ id: z.number().int() }).parse(req.body);
    validateChoices(payload.choices);
    const question = await prisma.$transaction(async (tx) => {
      const updated = await tx.question.update({
        where: { id: payload.id },
        data: {
          categoryId: payload.categoryId,
          body: payload.body,
          explanation: payload.explanation,
          isActive: payload.isActive ?? undefined,
        },
      });
      await tx.choice.deleteMany({ where: { questionId: payload.id } });
      await tx.choice.createMany({
        data: payload.choices.map((choice) => ({
          questionId: payload.id,
          label: choice.label,
          body: choice.body,
          isCorrect: choice.isCorrect,
        })),
      });
      return tx.question.findUnique({
        where: { id: updated.id },
        include: { choices: true },
      });
    });
    res.json({ question });
  })
);

router.delete(
  "/questions",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.number().int() }).parse(req.body);
    await prisma.question.delete({ where: { id } });
    res.json({ ok: true });
  })
);

router.patch(
  "/questions/:id/active",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      throw new ApiError(400, "INVALID_ID", "IDが不正です");
    }
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const question = await prisma.question.update({
      where: { id },
      data: { isActive },
    });
    res.json({ question });
  })
);

export default router;
