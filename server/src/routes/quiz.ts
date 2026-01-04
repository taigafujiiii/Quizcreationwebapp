import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { ApiError } from "../errors.js";
import { asyncHandler } from "../utils.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { assertSequenceMatch } from "../services/validation.js";

const router = Router();

router.use(requireAuth);

const allowedCounts = new Set([10, 20, 30, 40, 50]);

const startSchema = z.object({
  mode: z.enum(["A", "B", "C"]),
  requestedCount: z.number().int(),
  unitId: z.number().int().optional(),
  categoryId: z.number().int().optional(),
  categoryIds: z.array(z.number().int()).optional(),
});

async function selectQuestionIds(payload: z.infer<typeof startSchema>) {
  if (!allowedCounts.has(payload.requestedCount)) {
    throw new ApiError(400, "INVALID_COUNT", "出題数が不正です");
  }

  if (payload.mode === "A") {
    if (!payload.unitId) {
      throw new ApiError(400, "INVALID_UNIT", "単元を指定してください");
    }
    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT q.id
      FROM questions q
      JOIN categories c ON c.id = q.category_id
      WHERE c.unit_id = ${payload.unitId}
        AND q.is_active = true
      ORDER BY random()
      LIMIT ${payload.requestedCount}
    `);
    return { questionIds: rows.map((row) => row.id), unitId: payload.unitId };
  }

  if (payload.mode === "B") {
    if (!payload.categoryId) {
      throw new ApiError(400, "INVALID_CATEGORY", "カテゴリを指定してください");
    }
    const category = await prisma.category.findUnique({ where: { id: payload.categoryId } });
    if (!category) {
      throw new ApiError(404, "CATEGORY_NOT_FOUND", "カテゴリが見つかりません");
    }
    const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
      SELECT q.id
      FROM questions q
      WHERE q.category_id = ${payload.categoryId}
        AND q.is_active = true
      ORDER BY random()
      LIMIT ${payload.requestedCount}
    `);
    return { questionIds: rows.map((row) => row.id), unitId: category.unitId };
  }

  if (!payload.categoryIds || payload.categoryIds.length === 0) {
    throw new ApiError(400, "INVALID_CATEGORY", "カテゴリを指定してください");
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: payload.categoryIds } },
  });
  if (categories.length !== payload.categoryIds.length) {
    throw new ApiError(404, "CATEGORY_NOT_FOUND", "カテゴリが見つかりません");
  }
  const unitId = categories[0].unitId;
  if (!categories.every((category) => category.unitId === unitId)) {
    throw new ApiError(400, "INVALID_CATEGORY", "カテゴリは同一単元内で指定してください");
  }

  const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT q.id
    FROM questions q
    WHERE q.category_id IN (${Prisma.join(payload.categoryIds)})
      AND q.is_active = true
    ORDER BY random()
    LIMIT ${payload.requestedCount}
  `);
  return { questionIds: rows.map((row) => row.id), unitId };
}

async function getQuestionPayload(questionId: number) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { choices: true },
  });
  if (!question) {
    throw new ApiError(404, "QUESTION_NOT_FOUND", "問題が見つかりません");
  }
  const choices = question.choices
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((choice) => ({ label: choice.label, body: choice.body }));
  choices.push({ label: "UNKNOWN", body: "わからない" });

  return {
    id: question.id,
    body: question.body,
    choices,
  };
}

async function ensureAttemptActive(attempt: { id: string; status: string; expiresAt: Date }) {
  if (attempt.expiresAt < new Date()) {
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { status: "EXPIRED" },
    });
    throw new ApiError(410, "ATTEMPT_EXPIRED", "受験期限が切れています");
  }
  if (attempt.status === "EXPIRED") {
    throw new ApiError(410, "ATTEMPT_EXPIRED", "受験期限が切れています");
  }
}

router.post(
  "/start",
  asyncHandler(async (req, res) => {
    const payload = startSchema.parse(req.body);
    const { questionIds, unitId } = await selectQuestionIds(payload);

    if (questionIds.length === 0) {
      throw new ApiError(404, "NO_QUESTIONS", "出題できる問題がありません");
    }

    const actualCount = questionIds.length;
    const selectionJson = {
      mode: payload.mode,
      unitId,
      categoryId: payload.categoryId ?? null,
      categoryIds: payload.categoryIds ?? null,
      questionIds,
    };

    const attempt = await prisma.$transaction(async (tx) => {
      const created = await tx.quizAttempt.create({
        data: {
          userId: req.user!.id,
          mode: payload.mode,
          unitId,
          requestedCount: payload.requestedCount,
          actualCount,
          currentSeq: 1,
          status: "IN_PROGRESS",
          selectionJson,
          expiresAt: new Date(Date.now() + config.quizAttemptTtlHours * 60 * 60 * 1000),
        },
      });
      await tx.quizAttemptQuestion.createMany({
        data: questionIds.map((id, index) => ({
          attemptId: created.id,
          seq: index + 1,
          questionId: id,
        })),
      });
      return created;
    });

    const question = await getQuestionPayload(questionIds[0]);

    res.json({
      attemptId: attempt.id,
      currentSeq: 1,
      total: actualCount,
      question,
      resultAvailable: false,
    });
  })
);

const answerSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.number().int(),
  answer: z.enum(["A", "B", "C", "D", "UNKNOWN"]),
});

router.post(
  "/answer",
  asyncHandler(async (req, res) => {
    const payload = answerSchema.parse(req.body);

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: payload.attemptId },
    });
    if (!attempt || attempt.userId !== req.user!.id) {
      throw new ApiError(404, "ATTEMPT_NOT_FOUND", "受験が見つかりません");
    }

    await ensureAttemptActive(attempt);

    if (attempt.status !== "IN_PROGRESS") {
      throw new ApiError(409, "ATTEMPT_NOT_ACTIVE", "既に終了した受験です");
    }

    const currentQuestion = await prisma.quizAttemptQuestion.findUnique({
      where: { attemptId_seq: { attemptId: payload.attemptId, seq: attempt.currentSeq } },
    });
    if (!currentQuestion) {
      throw new ApiError(409, "INVALID_SEQUENCE", "回答順序が不正です");
    }
    assertSequenceMatch(currentQuestion.questionId, payload.questionId);

    const existingAnswer = await prisma.quizAttemptAnswer.findUnique({
      where: { attemptId_questionId: { attemptId: payload.attemptId, questionId: payload.questionId } },
    });
    if (existingAnswer) {
      throw new ApiError(409, "ALREADY_ANSWERED", "既に回答済みです");
    }

    const isLast = attempt.currentSeq >= attempt.actualCount;

    await prisma.$transaction(async (tx) => {
      await tx.quizAttemptAnswer.create({
        data: {
          attemptId: payload.attemptId,
          questionId: payload.questionId,
          answer: payload.answer,
          answeredAt: new Date(),
        },
      });
      await tx.quizAttempt.update({
        where: { id: payload.attemptId },
        data: isLast
          ? { status: "COMPLETED" }
          : { currentSeq: { increment: 1 } },
      });
    });

    if (isLast) {
      res.json({ resultAvailable: true });
      return;
    }

    const nextSeq = attempt.currentSeq + 1;
    const nextQuestion = await prisma.quizAttemptQuestion.findUnique({
      where: { attemptId_seq: { attemptId: payload.attemptId, seq: nextSeq } },
    });
    if (!nextQuestion) {
      throw new ApiError(409, "INVALID_SEQUENCE", "回答順序が不正です");
    }

    const question = await getQuestionPayload(nextQuestion.questionId);

    res.json({
      attemptId: payload.attemptId,
      currentSeq: nextSeq,
      total: attempt.actualCount,
      question,
      resultAvailable: false,
    });
  })
);

router.get(
  "/result",
  asyncHandler(async (req, res) => {
    const attemptId = z.string().uuid().parse(req.query.attemptId);
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt || attempt.userId !== req.user!.id) {
      throw new ApiError(404, "ATTEMPT_NOT_FOUND", "受験が見つかりません");
    }

    await ensureAttemptActive(attempt);

    if (attempt.status !== "COMPLETED") {
      throw new ApiError(409, "ATTEMPT_NOT_COMPLETED", "受験が完了していません");
    }

    const questions = await prisma.quizAttemptQuestion.findMany({
      where: { attemptId },
      orderBy: { seq: "asc" },
      include: {
        question: {
          include: { choices: true },
        },
      },
    });
    const answers = await prisma.quizAttemptAnswer.findMany({
      where: { attemptId },
    });
    const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));

    const resultItems = questions.map((entry) => {
      const answer = answerMap.get(entry.questionId);
      const correct = entry.question.choices.find((choice) => choice.isCorrect);
      const userAnswer = answer?.answer ?? null;
      const correctAnswer = correct?.label ?? null;
      const isCorrect = userAnswer && correctAnswer ? userAnswer === correctAnswer : false;
      return {
        questionId: entry.questionId,
        body: entry.question.body,
        userAnswer,
        correctAnswer,
        isCorrect,
        explanation: entry.question.explanation,
      };
    });

    const score = resultItems.filter((item) => item.isCorrect).length;

    res.json({
      attemptId,
      score,
      total: resultItems.length,
      results: resultItems,
    });
  })
);

export default router;
