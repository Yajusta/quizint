// Session REST routes (§5.4): creation with snapshot, public join lookup, history.

import { randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  ANSWERS_PAGE_SIZE_MAX,
  answerStatsByParticipant,
  buildQuizSnapshot,
  buildRanking,
  isJoinable,
  MAX_PARTICIPANTS_PER_SESSION,
  SESSION_CODE_ALPHABET,
  SESSION_CODE_LENGTH,
  type AnswerPayload,
  type LiveSessionSettings,
} from '@quiz/shared';
import type { Env } from '../../config.js';
import { asMediaKind, asPhase, asQuestionType } from '../../db/enums.js';
import { apiError, joinUrl, slugify, validationError } from '../../lib/api.js';
import { storedPlayedQuestionIds } from '../quizzes/routes.js';
import { buildAnswersCsv, buildScoresCsv } from './csv.js';

function generateSessionCode(): string {
  let code = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++)
    code += SESSION_CODE_ALPHABET[randomInt(SESSION_CODE_ALPHABET.length)];
  return code;
}

/** Stored rows in the shape the shared ranking helpers read. */
const toStatsParticipant = (p: {
  id: string;
  nickname: string;
  score: number;
  isKicked: boolean;
  joinedAt: Date;
}) => ({
  participantId: p.id,
  nickname: p.nickname,
  score: p.score,
  isKicked: p.isKicked,
  joinedAt: p.joinedAt.getTime(),
});
const toStatsAnswer = (a: {
  participantId: string;
  questionIndex: number;
  payload: unknown;
  isCorrect: boolean | null;
  pointsAwarded: number;
  elapsedMs: number;
}) => ({
  participantId: a.participantId,
  questionIndex: a.questionIndex,
  payload: a.payload as AnswerPayload,
  isCorrect: a.isCorrect,
  pointsAwarded: a.pointsAwarded,
  elapsedMs: a.elapsedMs,
});

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  /** Ownership check that only needs the id, quiz and phase. */
  const getOwnedSession = (sessionId: string, adminId: string) =>
    app.prisma.liveSession.findFirst({
      where: { id: sessionId, presenterId: adminId },
      select: { id: true, quizId: true, phase: true },
    });

  /**
   * Adds the questions answered in this session to `Quiz.playedQuestionIds`. Read-modify-write in
   * one transaction: two sessions of the same quiz deleted together must not drop each other's ids.
   */
  const recordPlayedQuestions = async (session: { id: string; quizId: string }): Promise<void> => {
    const answered = await app.prisma.answer.findMany({
      where: { sessionId: session.id },
      select: { questionId: true },
      distinct: ['questionId'],
    });
    if (answered.length === 0) return;
    const { quizId } = session;
    await app.prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.findUnique({ where: { id: quizId }, select: { playedQuestionIds: true } });
      if (!quiz) return;
      const stored = storedPlayedQuestionIds(quiz.playedQuestionIds);
      const merged = [...new Set([...stored, ...answered.map((a) => a.questionId)])];
      if (merged.length === stored.length) return;
      await tx.quiz.update({ where: { id: quizId }, data: { playedQuestionIds: merged } });
    });
  };

  const toSnapshotMedia = (
    m: {
      kind: string;
      storageKey: string;
      width: number | null;
      height: number | null;
      durationSec: number | null;
    } | null,
  ) =>
    m
      ? {
          kind: asMediaKind(m.kind),
          storageKey: m.storageKey,
          width: m.width,
          height: m.height,
          durationSec: m.durationSec,
        }
      : null;

  // --- POST /quizzes/:id/sessions — create a live session with a frozen snapshot -----
  app.post<{ Params: { id: string } }>(
    '/quizzes/:id/sessions',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const quiz = await app.prisma.quiz.findFirst({
        where: { id: req.params.id, ownerId: req.adminId!, archivedAt: null },
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: {
              choices: { orderBy: { position: 'asc' }, include: { media: true } },
              media: true,
            },
          },
        },
      });
      if (!quiz) return reply.status(404).send(apiError('NOT_FOUND'));
      if (quiz.questions.length === 0) {
        return reply.status(409).send(apiError('VALIDATION', 'un quiz nécessite au moins une question'));
      }

      const config = app.config;
      const snapshot = buildQuizSnapshot(
        {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          questions: quiz.questions.map((q) => ({
            id: q.id,
            position: q.position,
            type: asQuestionType(q.type),
            prompt: q.prompt,
            mediaOnParticipants: q.mediaOnParticipants,
            pointsCorrect: q.pointsCorrect,
            pointsWrong: q.pointsWrong,
            timeLimitSec: q.timeLimitSec,
            speedBonusMax: q.speedBonusMax,
            numericAnswer: q.numericAnswer as never,
            media: toSnapshotMedia(q.media),
            choices: q.choices.map((c) => ({
              id: c.id,
              position: c.position,
              label: c.label,
              isCorrect: c.isCorrect,
              media: toSnapshotMedia(c.media),
            })),
          })),
        },
        config.PUBLIC_URL,
      );

      // Unique global code — retry on collision (5 attempts max).
      let code = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateSessionCode();
        const exists = await app.prisma.liveSession.findUnique({
          where: { code: candidate },
          select: { id: true },
        });
        if (!exists) {
          code = candidate;
          break;
        }
      }
      if (!code) return reply.status(500).send(apiError('INTERNAL', 'code generation failed'));

      const quizSettings = quiz.settings as Record<string, unknown>;
      const settings: LiveSessionSettings = {
        showIntermediateRanking: quizSettings.showIntermediateRanking !== false,
        showParticipantAnswers: quizSettings.showParticipantAnswers === true,
      };

      const session = await app.prisma.liveSession.create({
        data: {
          code,
          quizId: quiz.id,
          presenterId: req.adminId!,
          quizSnapshot: snapshot as unknown as object,
          settings,
          phase: 'LOBBY',
        },
        // Not the whole row: it would read back and parse the snapshot just written.
        select: { id: true, code: true },
      });

      return reply.status(201).send({
        sessionId: session.id,
        code: session.code,
        joinUrl: joinUrl(config.PUBLIC_URL, session.code),
      });
    },
  );

  // --- GET /join/:code — public, rate-limited (a whole room shares one IP) ------------
  // Above the room cap with room for reloads: 500 phones behind one corporate NAT opening the
  // page in the same minute must all get their title and count.
  app.get<{ Params: { code: string } }>(
    '/join/:code',
    { config: { rateLimit: { max: MAX_PARTICIPANTS_PER_SESSION * 3, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const session = await app.prisma.liveSession.findUnique({
        where: { code: req.params.code.toUpperCase() },
        select: {
          id: true,
          phase: true,
          quizSnapshot: true,
          _count: { select: { participants: { where: { isKicked: false } } } },
        },
      });
      if (!session) return reply.status(404).send(apiError('SESSION_NOT_FOUND'));
      const phase = asPhase(session.phase);
      if (!isJoinable(phase)) return reply.status(410).send(apiError('SESSION_CLOSED_TO_JOIN'));
      const snapshot = session.quizSnapshot as { title?: string };
      return {
        sessionId: session.id,
        quizTitle: snapshot.title ?? '',
        phase,
        participantCount: session._count.participants,
      };
    },
  );

  // --- GET /sessions — the admin's history ------------------------------------------
  app.get('/sessions', { preHandler: app.authenticate }, async (req) => {
    const sessions = await app.prisma.liveSession.findMany({
      where: { presenterId: req.adminId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        code: true,
        phase: true,
        startedAt: true,
        endedAt: true,
        createdAt: true,
        quiz: { select: { title: true } },
        _count: { select: { participants: { where: { isKicked: false } } } },
      },
    });
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        code: s.code,
        quizTitle: s.quiz.title,
        phase: asPhase(s.phase),
        participantCount: s._count.participants,
        startedAt: s.startedAt?.getTime() ?? null,
        endedAt: s.endedAt?.getTime() ?? null,
        createdAt: s.createdAt.getTime(),
      })),
    };
  });

  // --- GET /sessions/:id ------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/sessions/:id',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const session = await app.prisma.liveSession.findFirst({
        where: { id: req.params.id, presenterId: req.adminId! },
        include: {
          participants: { orderBy: { joinedAt: 'asc' } },
          questionResults: { orderBy: { questionIndex: 'asc' } },
          answers: {
            select: {
              participantId: true,
              questionIndex: true,
              payload: true,
              isCorrect: true,
              pointsAwarded: true,
              elapsedMs: true,
            },
          },
        },
      });
      if (!session) return reply.status(404).send(apiError('NOT_FOUND'));
      // The history page shows the same ranking as the stage and the CSV (score, then total correct
      // time, dense ranks), so it is computed here with the shared helper rather than by score alone.
      const ranking = buildRanking(
        session.participants.map(toStatsParticipant),
        session.answers.map(toStatsAnswer),
      );
      return {
        session: {
          id: session.id,
          code: session.code,
          quizSnapshot: session.quizSnapshot,
          phase: asPhase(session.phase),
          currentQuestionIndex: session.currentQuestionIndex,
          startedAt: session.startedAt?.getTime() ?? null,
          endedAt: session.endedAt?.getTime() ?? null,
          createdAt: session.createdAt.getTime(),
          participants: session.participants.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            score: p.score,
            isKicked: p.isKicked,
            joinedAt: p.joinedAt.getTime(),
          })),
          ranking: ranking.map((r) => ({
            participantId: r.participantId,
            nickname: r.nickname,
            score: r.score,
            rank: r.rank,
          })),
          questionResults: session.questionResults.map((r) => ({
            questionIndex: r.questionIndex,
            answersCount: r.answersCount,
            correctCount: r.correctCount,
            distribution: r.distribution,
            fastestCorrect: r.fastestCorrect,
          })),
        },
      };
    },
  );

  // --- POST /sessions/:id/end — force ENDED (fallback if the socket is lost) ---------
  app.post<{ Params: { id: string } }>(
    '/sessions/:id/end',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const session = await getOwnedSession(req.params.id, req.adminId!);
      if (!session) return reply.status(404).send(apiError('NOT_FOUND'));
      if (session.phase === 'ENDED') return reply.status(204).send();
      // Through the live engine, not a bare UPDATE: timers stop, answers are refused and both
      // audiences receive session:ended.
      const live = await app.sessionManager.getOrLoad(session.id);
      if (live) await app.sessionManager.endSession(live);
      return reply.status(204).send();
    },
  );

  // --- GET /sessions/:id/answers — paginated (lot 7) ---------------------------------
  const AnswersQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(ANSWERS_PAGE_SIZE_MAX).default(100),
  });
  app.get<{ Params: { id: string }; Querystring: unknown }>(
    '/sessions/:id/answers',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const session = await getOwnedSession(req.params.id, req.adminId!);
      if (!session) return reply.status(404).send(apiError('NOT_FOUND'));
      const query = AnswersQuery.safeParse(req.query);
      if (!query.success) return reply.status(400).send(validationError(query.error));
      const { page, pageSize } = query.data;
      const [rows, total] = await Promise.all([
        app.prisma.answer.findMany({
          where: { sessionId: session.id },
          orderBy: [{ questionIndex: 'asc' }, { answeredAt: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        app.prisma.answer.count({ where: { sessionId: session.id } }),
      ]);
      return {
        answers: rows.map((a) => ({
          participantId: a.participantId,
          questionIndex: a.questionIndex,
          payload: a.payload,
          isCorrect: a.isCorrect,
          pointsBase: a.pointsBase,
          pointsBonus: a.pointsBonus,
          pointsAwarded: a.pointsAwarded,
          elapsedMs: a.elapsedMs,
          answeredAt: a.answeredAt.getTime(),
        })),
        page,
        pageSize,
        total,
      };
    },
  );

  // --- GET /sessions/:id/export.csv?kind=scores|answers (lot 7) -----------------------
  app.get<{ Params: { id: string }; Querystring: { kind?: string } }>(
    '/sessions/:id/export.csv',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const session = await app.prisma.liveSession.findFirst({
        where: { id: req.params.id, presenterId: req.adminId! },
        include: {
          participants: true,
          answers: { orderBy: [{ questionIndex: 'asc' }, { answeredAt: 'asc' }] },
        },
      });
      if (!session) return reply.status(404).send(apiError('NOT_FOUND'));

      const kind = req.query.kind === 'answers' ? 'answers' : 'scores';
      const slug = slugify((session.quizSnapshot as unknown as { title?: string }).title ?? 'quiz');
      const date = new Date(session.createdAt).toISOString().slice(0, 10);

      let csv: string;
      if (kind === 'answers') {
        csv = buildAnswersCsv(session);
      } else {
        // Same ranking as the live final view (score, then total correct time, dense ranks):
        // the shared `buildRanking` drops kicked participants, appended unranked below. The
        // per-participant counts come from the same shared pass the ranking is built on.
        const answers = session.answers.map(toStatsAnswer);
        const ranking = buildRanking(session.participants.map(toStatsParticipant), answers);
        const statsByParticipant = answerStatsByParticipant(answers);
        const rows = [
          ...ranking.map((r) => ({
            participantId: r.participantId,
            nickname: r.nickname,
            score: r.score,
            rank: r.rank as number | null,
            isKicked: false,
          })),
          ...session.participants
            .filter((p) => p.isKicked)
            .map((p) => ({
              participantId: p.id,
              nickname: p.nickname,
              score: p.score,
              rank: null,
              isKicked: true,
            })),
        ];
        csv = buildScoresCsv(rows, statsByParticipant);
      }

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="quiz-${slug}-${date}-${kind}.csv"`)
        .send(csv);
    },
  );

  // --- DELETE /sessions/:id — full data removal (RGPD) ---------------------------------
  app.delete<{ Params: { id: string } }>(
    '/sessions/:id',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const session = await getOwnedSession(req.params.id, req.adminId!);
      if (!session) return reply.status(404).send(apiError('NOT_FOUND'));
      // End it first, through the live engine: once ENDED no answer can land any more, so the
      // answered set read below is final.
      if (session.phase !== 'ENDED') {
        const live = await app.sessionManager.getOrLoad(session.id);
        if (live) await app.sessionManager.endSession(live);
      }
      // The answers cascade away with the session; the questions they were given to stay played
      // (QUIZ_LOCKED), so they are recorded on the quiz before the delete.
      await recordPlayedQuestions(session);
      await app.sessionManager.deleteSession(session.id);
      return reply.status(204).send();
    },
  );
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Env;
  }
}
