// Quiz routes (§5.2): CRUD, transactional question replacement with id preservation,
// locking rules, duplication, JSON import/export.

import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import {
  mediaUrl,
  QuestionsReplaceInput,
  QuizCreateInput,
  QuizExportV1,
  QuizPatchInput,
  QuizSettings,
} from '@quiz/shared';

import { apiError, slugify, validationError } from '../../lib/api.js';

const DEFAULT_SETTINGS = QuizSettings.parse({});

/** Comparable form of a numeric answer (stored JSON or parsed input), defaults applied. */
function numericAnswerKey(raw: unknown): string | null {
  const n = raw as { value?: number; tolerance?: number; toleranceMode?: string } | null | undefined;
  return n ? `${n.value}|${n.tolerance ?? 0}|${n.toleranceMode ?? 'ABSOLUTE'}` : null;
}

export async function quizRoutes(app: FastifyInstance): Promise<void> {
  /** A session that is not over still runs on the quiz's frozen snapshot. */
  const hasLiveSession = async (quizId: string): Promise<boolean> =>
    (await app.prisma.liveSession.count({ where: { quizId, phase: { not: 'ENDED' } } })) > 0;

  /**
   * Locked = a question has answers, or a session that is not over still runs on the quiz. Answers
   * cascade away with their session: once every session that answered is deleted, the quiz unlocks.
   */
  const isQuizLocked = async (quiz: { id: string }): Promise<boolean> =>
    (await app.prisma.question.count({ where: { quizId: quiz.id, answers: { some: {} } } })) > 0 ||
    (await hasLiveSession(quiz.id));

  function getOwnedQuiz(quizId: string, adminId: string) {
    return app.prisma.quiz.findFirst({
      where: { id: quizId, ownerId: adminId, archivedAt: null },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { choices: { orderBy: { position: 'asc' }, include: { media: true } }, media: true },
        },
      },
    });
  }

  /** Ownership check without loading the question tree. */
  function getOwnedQuizHead(quizId: string, adminId: string) {
    return app.prisma.quiz.findFirst({
      where: { id: quizId, ownerId: adminId, archivedAt: null },
      select: { id: true, settings: true },
    });
  }

  type QuestionRow = NonNullable<Awaited<ReturnType<typeof getOwnedQuiz>>>['questions'][number];
  type MediaRow = QuestionRow['media'];

  function toQuestionDTO(q: QuestionRow) {
    const toMediaDTO = (m: MediaRow) =>
      m
        ? {
            kind: m.kind,
            url: `/uploads/${m.storageKey}`,
            width: m.width,
            height: m.height,
            durationSec: m.durationSec,
          }
        : null;
    return {
      id: q.id,
      position: q.position,
      type: q.type,
      prompt: q.prompt,
      mediaId: q.mediaId,
      media: toMediaDTO(q.media),
      mediaOnParticipants: q.mediaOnParticipants,
      pointsCorrect: q.pointsCorrect,
      pointsWrong: q.pointsWrong,
      timeLimitSec: q.timeLimitSec,
      speedBonusMax: q.speedBonusMax,
      choices: q.choices.map((c) => ({
        id: c.id,
        position: c.position,
        label: c.label,
        mediaId: c.mediaId,
        media: toMediaDTO(c.media),
        isCorrect: c.isCorrect,
      })),
      numericAnswer:
        (q.numericAnswer as {
          value: number;
          tolerance: number;
          toleranceMode: 'ABSOLUTE' | 'PERCENT';
        } | null) ?? null,
    };
  }

  // --- GET /quizzes — the library, or the archived quizzes with ?archived=true -----------
  app.get<{ Querystring: { archived?: string } }>(
    '/quizzes',
    { preHandler: app.authenticate },
    async (req) => {
      const archived = req.query.archived === 'true';
      const quizzes = await app.prisma.quiz.findMany({
        where: { ownerId: req.adminId!, archivedAt: archived ? { not: null } : null },
        orderBy: archived ? { archivedAt: 'desc' } : { updatedAt: 'desc' },
        include: {
          _count: { select: { questions: true, sessions: true } },
          // Last *played* session: a lobby that was never started (cancelled) must not hide the date.
          sessions: {
            where: { startedAt: { not: null } },
            select: { startedAt: true, endedAt: true },
            orderBy: { startedAt: 'desc' },
            take: 1,
          },
        },
      });
      return {
        quizzes: quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          settings: q.settings,
          questionCount: q._count.questions,
          sessionCount: q._count.sessions,
          lastPlayedAt: q.sessions[0]?.startedAt?.getTime() ?? null,
          createdAt: q.createdAt.getTime(),
          updatedAt: q.updatedAt.getTime(),
          archivedAt: q.archivedAt?.getTime() ?? null,
        })),
      };
    },
  );

  // --- POST /quizzes ----------------------------------------------------------
  app.post('/quizzes', { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = QuizCreateInput.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
    const quiz = await app.prisma.quiz.create({
      data: {
        ownerId: req.adminId!,
        title: parsed.data.title,
        description: parsed.data.description,
        settings: { ...DEFAULT_SETTINGS, ...parsed.data.settings },
      },
    });
    return reply.status(201).send({
      quiz: { id: quiz.id, title: quiz.title, description: quiz.description, settings: quiz.settings },
    });
  });

  // --- GET /quizzes/:id ---------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/quizzes/:id',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const quiz = await getOwnedQuiz(req.params.id, req.adminId!);
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));
      // Same rule as the PUT lock: a quiz is locked once one of its questions has been answered
      // (even in a session deleted since), or while a session that is not over still runs on its
      // frozen snapshot.
      const isLocked = await isQuizLocked(quiz);
      return {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          settings: quiz.settings,
          createdAt: quiz.createdAt.getTime(),
          updatedAt: quiz.updatedAt.getTime(),
          isLocked,
          questions: quiz.questions.map(toQuestionDTO),
        },
      };
    },
  );

  // --- PATCH /quizzes/:id --------------------------------------------------------
  app.patch<{ Params: { id: string } }>(
    '/quizzes/:id',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const parsed = QuizPatchInput.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
      const quiz = await getOwnedQuizHead(req.params.id, req.adminId!);
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));
      await app.prisma.quiz.update({
        where: { id: quiz.id },
        data: {
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.settings !== undefined
            ? { settings: { ...(quiz.settings as object), ...parsed.data.settings } }
            : {}),
        },
      });
      return reply.status(204).send();
    },
  );

  // --- POST /quizzes/:id/archive — hide from the library (reversible) -------------------
  app.post<{ Params: { id: string } }>(
    '/quizzes/:id/archive',
    { preHandler: app.authenticate },
    async (req, reply) => {
      // Check and write in one conditional statement: a session created between a bare check and
      // the update would be left running on an archived quiz. The session creation reads the quiz
      // in its own transaction, so one of the two always sees the other's outcome.
      const { count } = await app.prisma.quiz.updateMany({
        where: {
          id: req.params.id,
          ownerId: req.adminId!,
          archivedAt: null,
          sessions: { none: { phase: { not: 'ENDED' } } },
        },
        data: { archivedAt: new Date() },
      });
      if (count > 0) return reply.status(204).send();
      // Nothing archived: tell a missing quiz from one a session still runs on.
      const quiz = await getOwnedQuizHead(req.params.id, req.adminId!);
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));
      return reply.status(409).send(apiError('QUIZ_HAS_SESSION_IN_PROGRESS'));
    },
  );

  // --- POST /quizzes/:id/restore — back to the library ------------------------------------
  app.post<{ Params: { id: string } }>(
    '/quizzes/:id/restore',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const quiz = await app.prisma.quiz.findFirst({
        where: { id: req.params.id, ownerId: req.adminId!, archivedAt: { not: null } },
        select: { id: true },
      });
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));
      await app.prisma.quiz.update({ where: { id: quiz.id }, data: { archivedAt: null } });
      return reply.status(204).send();
    },
  );

  // --- DELETE /quizzes/:id — permanent removal of an archived quiz and all its sessions -----
  app.delete<{ Params: { id: string } }>(
    '/quizzes/:id',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const quiz = await app.prisma.quiz.findFirst({
        where: { id: req.params.id, ownerId: req.adminId! },
        select: { id: true, archivedAt: true },
      });
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));
      // Archiving first is the confirmation step: a library quiz is never one click from deletion.
      if (!quiz.archivedAt) return reply.status(409).send(apiError('QUIZ_NOT_ARCHIVED'));
      // Sessions go through the SessionManager: a loaded one is stopped before its rows disappear.
      const sessions = await app.prisma.liveSession.findMany({
        where: { quizId: quiz.id },
        select: { id: true },
      });
      for (const s of sessions) await app.sessionManager.deleteSession(s.id);
      // Questions and choices cascade; media stay in the library (SetNull on the question side).
      await app.prisma.quiz.delete({ where: { id: quiz.id } });
      return reply.status(204).send();
    },
  );

  // --- POST /quizzes/:id/duplicate -------------------------------------------------
  app.post<{ Params: { id: string } }>(
    '/quizzes/:id/duplicate',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const quiz = await getOwnedQuiz(req.params.id, req.adminId!);
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));
      // Same owner rule as the questions PUT and the import: only this admin's uploads carry over.
      // The PUT refuses a foreign media id, but a row written before that check (or by hand) may
      // still hold one; the copy drops it, like the import, rather than launder it into a new quiz.
      // Refusing instead would take away duplication, the escape hatch of a played quiz.
      const ownMediaId = (id: string | null, media: MediaRow): string | null =>
        id !== null && media?.ownerId === req.adminId ? id : null;
      const copy = await app.prisma.quiz.create({
        data: {
          ownerId: req.adminId!,
          title: `${quiz.title} (copie)`,
          description: quiz.description,
          settings: quiz.settings as object,
          questions: {
            create: quiz.questions.map((q) => ({
              position: q.position,
              type: q.type,
              prompt: q.prompt,
              mediaId: ownMediaId(q.mediaId, q.media),
              mediaOnParticipants: q.mediaOnParticipants,
              pointsCorrect: q.pointsCorrect,
              pointsWrong: q.pointsWrong,
              timeLimitSec: q.timeLimitSec,
              speedBonusMax: q.speedBonusMax,
              numericAnswer: q.numericAnswer as object,
              choices: {
                create: q.choices.map((c) => ({
                  position: c.position,
                  label: c.label,
                  mediaId: ownMediaId(c.mediaId, c.media),
                  isCorrect: c.isCorrect,
                })),
              },
            })),
          },
        },
      });
      return reply.status(201).send({ quiz: { id: copy.id, title: copy.title } });
    },
  );

  // --- PUT /quizzes/:id/questions — transactional full replacement ------------------
  app.put<{ Params: { id: string } }>(
    '/quizzes/:id/questions',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const parsed = QuestionsReplaceInput.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
      const quiz = await getOwnedQuiz(req.params.id, req.adminId!);
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));

      // Media ids must name rows of this admin: a stale id (a 24 h local draft outliving a deleted
      // upload) would otherwise fail the transaction as a foreign-key error, a bare 500 with no
      // pointer to the question, and another owner's media must not be referenced at all.
      const mediaRefs = parsed.data.questions.flatMap((q, index) => [
        ...(q.mediaId ? [{ index, mediaId: q.mediaId }] : []),
        ...q.choices.flatMap((c) => (c.mediaId ? [{ index, mediaId: c.mediaId }] : [])),
      ]);
      if (mediaRefs.length > 0) {
        const owned = new Set(
          (
            await app.prisma.media.findMany({
              where: { id: { in: [...new Set(mediaRefs.map((m) => m.mediaId))] }, ownerId: req.adminId! },
              select: { id: true },
            })
          ).map((m) => m.id),
        );
        const missing = mediaRefs.find((m) => !owned.has(m.mediaId));
        if (missing) {
          return reply
            .status(400)
            .send(apiError('VALIDATION', { question: missing.index, reason: 'media not found' }));
        }
      }

      // Shape rules already ran: QuestionInput refines every question with validateQuestionShape.
      // Ids must name rows of this quiz, each used once: an update must not reach another owner's
      // question, nor move a choice under another question (which would dodge the lock below).
      const existingById = new Map(quiz.questions.map((q) => [q.id, q]));
      const seenQuestionIds = new Set<string>();
      const seenChoiceIds = new Set<string>();
      for (const incoming of parsed.data.questions) {
        if (!incoming.id) continue; // new question: choice ids are ignored on create
        const existing = existingById.get(incoming.id);
        if (!existing || seenQuestionIds.has(incoming.id)) {
          return reply
            .status(400)
            .send(apiError('VALIDATION', `question inconnue dans ce quiz : ${incoming.id}`));
        }
        seenQuestionIds.add(incoming.id);
        for (const c of incoming.choices) {
          if (!c.id) continue;
          if (seenChoiceIds.has(c.id) || !existing.choices.some((ec) => ec.id === c.id)) {
            return reply
              .status(400)
              .send(apiError('VALIDATION', `choix inconnu pour cette question : ${c.id}`));
          }
          seenChoiceIds.add(c.id);
        }
      }

      // A session that is not over runs on a snapshot that names every question by id and
      // `Answer.questionId` restricts deletion: a question dropped before it is reached would fail
      // every answer of that round. While such a session exists, every existing question is locked.
      // Otherwise a question is played while it holds answers, i.e. while a session that answered it
      // still exists.
      const liveAtCheck = await hasLiveSession(quiz.id);
      const playedQuestionIds = liveAtCheck
        ? new Set(quiz.questions.map((q) => q.id))
        : new Set(
            (
              await app.prisma.question.findMany({
                where: { quizId: quiz.id, answers: { some: {} } },
                select: { id: true },
              })
            ).map((q) => q.id),
          );

      // Locking rules (§3.2): played questions cannot be deleted, reordered, retyped, re-choice'd,
      // re-scored or given another correct answer.
      type IncomingQuestion = (typeof parsed.data.questions)[number];
      const lockViolation = (
        existing: QuestionRow,
        index: number,
        incoming: IncomingQuestion | undefined,
        incomingIndex: number | undefined,
      ): string | null => {
        if (!incoming) return 'played question removed';
        if (incoming.type !== existing.type) return 'type changed';
        if (incomingIndex !== index) return 'question reordered';
        // The whole scoring input is frozen: base points, speed bonus and time limit all feed
        // `scoreAnswer`, so any of them changing would make the stored points unexplainable.
        if (
          incoming.pointsCorrect !== existing.pointsCorrect ||
          incoming.pointsWrong !== existing.pointsWrong ||
          incoming.speedBonusMax !== existing.speedBonusMax ||
          incoming.timeLimitSec !== existing.timeLimitSec
        ) {
          return 'scoring changed';
        }
        // Same choices, same order, same ids: the transaction below then never deletes a played choice.
        const sameChoices =
          incoming.choices.length === existing.choices.length &&
          incoming.choices.every(
            (c, ci) => c.id === existing.choices[ci]?.id && c.label === existing.choices[ci]?.label,
          );
        if (!sameChoices) return 'choices changed';
        const sameCorrectAnswer =
          incoming.choices.every((c, ci) => c.isCorrect === existing.choices[ci]?.isCorrect) &&
          numericAnswerKey(incoming.numericAnswer) === numericAnswerKey(existing.numericAnswer);
        return sameCorrectAnswer ? null : 'correct answer changed';
      };
      // Ids were checked unique above, so one index per id.
      const incomingIndexById = new Map(
        parsed.data.questions.flatMap((q, i) => (q.id ? [[q.id, i] as const] : [])),
      );
      for (const [index, existing] of quiz.questions.entries()) {
        if (!playedQuestionIds.has(existing.id)) continue;
        const incomingIndex = incomingIndexById.get(existing.id);
        const incoming = incomingIndex === undefined ? undefined : parsed.data.questions[incomingIndex];
        const reason = lockViolation(existing, index, incoming, incomingIndex);
        if (reason) {
          return reply.status(423).send(apiError('QUIZ_LOCKED', { questionId: existing.id, reason }));
        }
      }

      // Transactional replacement: keep ids provided, create new, delete missing (non-locked).
      // Every statement is known up front (nothing is read inside), so they go as one batch: an
      // interactive transaction would cost a round trip per statement on the single connection and
      // hit Prisma's 5 s limit on a 200-question quiz, blocking every live write meanwhile.
      const { prisma } = app;
      const ops: Prisma.PrismaPromise<unknown>[] = [];
      // The lock was read before the transaction: a session created (or answered) in between would
      // let a now-played question through. The first statement re-asserts, inside the transaction,
      // every fact the check relied on; it matches no row when one changed, and the P2025 it raises
      // rolls the whole batch back. A session deleted in between only loosens the lock.
      const unlockedIds = quiz.questions.map((q) => q.id).filter((id) => !playedQuestionIds.has(id));
      ops.push(
        prisma.quiz.update({
          where: {
            id: quiz.id,
            ...(liveAtCheck ? {} : { sessions: { none: { phase: { not: 'ENDED' } } } }),
            ...(unlockedIds.length > 0
              ? { questions: { none: { id: { in: unlockedIds }, answers: { some: {} } } } }
              : {}),
          },
          data: {},
          select: { id: true },
        }),
      );
      for (const existing of quiz.questions) {
        if (!incomingIndexById.has(existing.id) && !playedQuestionIds.has(existing.id)) {
          ops.push(prisma.question.delete({ where: { id: existing.id } }));
        }
      }
      // `(quizId, position)` is unique and rows are rewritten one by one: swapping two kept
      // questions would collide on the way. Park every kept question on a free negative
      // position first, then write the final order (same for kept choices below).
      for (const [index, q] of parsed.data.questions.entries()) {
        if (q.id) ops.push(prisma.question.update({ where: { id: q.id }, data: { position: -(index + 1) } }));
      }
      const toChoiceData = (c: IncomingQuestion['choices'][number], ci: number) => ({
        position: ci,
        label: c.label,
        mediaId: c.mediaId,
        isCorrect: c.isCorrect,
      });
      for (const [index, q] of parsed.data.questions.entries()) {
        const common: Record<string, unknown> = {
          position: index,
          type: q.type,
          prompt: q.prompt,
          mediaId: q.mediaId,
          mediaOnParticipants: q.mediaOnParticipants,
          pointsCorrect: q.pointsCorrect,
          pointsWrong: q.pointsWrong,
          timeLimitSec: q.timeLimitSec,
          speedBonusMax: q.speedBonusMax,
          numericAnswer: q.numericAnswer as object | null,
        };
        if (q.id) {
          ops.push(prisma.question.update({ where: { id: q.id }, data: common as never }));
          // Replace choices (keep ids provided).
          const keepChoiceIds = new Set(q.choices.filter((c) => c.id).map((c) => c.id as string));
          // Played questions were checked above to keep every choice id, so only unplayed ones delete.
          for (const existingChoice of existingById.get(q.id)?.choices ?? []) {
            if (!keepChoiceIds.has(existingChoice.id))
              ops.push(prisma.choice.delete({ where: { id: existingChoice.id } }));
          }
          for (const [ci, c] of q.choices.entries()) {
            if (c.id) ops.push(prisma.choice.update({ where: { id: c.id }, data: { position: -(ci + 1) } }));
          }
          for (const [ci, c] of q.choices.entries()) {
            const choiceData = toChoiceData(c, ci);
            if (c.id) {
              ops.push(prisma.choice.update({ where: { id: c.id }, data: choiceData }));
            } else {
              ops.push(prisma.choice.create({ data: { ...choiceData, questionId: q.id } }));
            }
          }
        } else {
          ops.push(
            prisma.question.create({
              data: {
                ...common,
                quizId: quiz.id,
                choices: { create: q.choices.map(toChoiceData) },
              } as never,
            }),
          );
        }
      }
      try {
        await prisma.$transaction(ops);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2025' &&
          err.meta?.modelName === 'Quiz'
        ) {
          return reply.status(423).send(apiError('QUIZ_LOCKED', { reason: 'lock changed during save' }));
        }
        throw err;
      }

      const updated = await getOwnedQuiz(quiz.id, req.adminId!);
      return { quiz: { ...updated, questions: updated?.questions.map(toQuestionDTO) ?? [] } };
    },
  );

  // --- GET /quizzes/:id/export ---------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/quizzes/:id/export',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const quiz = await getOwnedQuiz(req.params.id, req.adminId!);
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));
      const exportMedia = (m: MediaRow) =>
        m && { kind: m.kind, url: mediaUrl(app.config.PUBLIC_URL, m.storageKey) };
      const payload = {
        format: 'quiz-interactif/quiz' as const,
        version: 1 as const,
        title: quiz.title,
        description: quiz.description,
        settings: quiz.settings,
        questions: quiz.questions.map((q) => ({
          type: q.type,
          prompt: q.prompt,
          media: exportMedia(q.media),
          mediaOnParticipants: q.mediaOnParticipants,
          pointsCorrect: q.pointsCorrect,
          pointsWrong: q.pointsWrong,
          timeLimitSec: q.timeLimitSec,
          speedBonusMax: q.speedBonusMax,
          choices: q.choices.map((c) => ({
            label: c.label,
            media: exportMedia(c.media),
            isCorrect: c.isCorrect,
          })),
          numericAnswer: q.numericAnswer ?? null,
        })),
      };
      return reply
        .header('Content-Disposition', `attachment; filename="quiz-${slugify(quiz.title)}.json"`)
        .send(payload);
    },
  );

  // --- POST /quizzes/import --------------------------------------------------------
  app.post('/quizzes/import', { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = QuizExportV1.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
    const warnings: string[] = [];

    // Reuse this admin's own media when the export references this server; ignore otherwise.
    // Owner-scoped like the questions PUT: another admin's upload must neither be playable here
    // nor blocked from deletion by a reference its owner cannot see.
    const storageKeyOf = (url: string): string | null => {
      const marker = '/uploads/';
      const idx = url.indexOf(marker);
      return idx === -1 ? null : url.slice(idx + marker.length);
    };
    // One query for the whole file: a lookup per question and per choice would queue hundreds of
    // reads on the single connection, ahead of the live writes.
    const storageKeys = parsed.data.questions
      .flatMap((q) => [q.media, ...q.choices.map((c) => c.media)])
      .flatMap((m) => (m ? [storageKeyOf(m.url)] : []))
      .filter((key): key is string => key !== null);
    const mediaIdByKey = new Map(
      storageKeys.length > 0
        ? (
            await app.prisma.media.findMany({
              where: { ownerId: req.adminId!, storageKey: { in: [...new Set(storageKeys)] } },
              select: { id: true, storageKey: true },
            })
          ).map((m) => [m.storageKey, m.id])
        : [],
    );
    function resolveMedia(m: { kind: string; url: string } | null): string | null {
      if (!m) return null;
      const storageKey = storageKeyOf(m.url);
      if (storageKey === null) {
        warnings.push(`Média externe ignoré : ${m.url}`);
        return null;
      }
      const mediaId = mediaIdByKey.get(storageKey);
      if (!mediaId) {
        warnings.push(`Média introuvable ignoré : ${m.url}`);
        return null;
      }
      return mediaId;
    }

    const quiz = await app.prisma.quiz.create({
      data: {
        ownerId: req.adminId!,
        title: parsed.data.title,
        description: parsed.data.description,
        settings: { ...DEFAULT_SETTINGS, ...parsed.data.settings },
        questions: {
          create: parsed.data.questions.map((q, index) => ({
            position: index,
            type: q.type,
            prompt: q.prompt,
            mediaId: resolveMedia(q.media),
            mediaOnParticipants: q.mediaOnParticipants,
            pointsCorrect: q.pointsCorrect,
            pointsWrong: q.pointsWrong,
            timeLimitSec: q.timeLimitSec,
            speedBonusMax: q.speedBonusMax,
            numericAnswer: q.numericAnswer as object | null,
            choices: {
              create: q.choices.map((c, ci) => ({
                position: ci,
                label: c.label,
                mediaId: resolveMedia(c.media),
                isCorrect: c.isCorrect,
              })),
            },
          })) as never,
        },
      },
      select: { id: true, title: true },
    });

    return reply.status(201).send({
      quiz: { ...quiz, questionCount: parsed.data.questions.length },
      warnings,
    });
  });
}
