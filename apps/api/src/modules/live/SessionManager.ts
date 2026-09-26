// SessionManager (§6.5) — the live engine: hot state in memory, durable writes in SQLite,
// per-session mutex, re-armable timers, getOrLoad for transparent restarts.

import { randomBytes, randomUUID } from 'node:crypto';
import { Mutex } from 'async-mutex';
import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { Server as SocketIOServer, Socket } from 'socket.io';

import { asPhase } from '../../db/enums.js';
import { joinUrl, sha256 } from '../../lib/api.js';

import {
  answeredInOrder,
  buildFinalStats,
  buildQuestionDistribution,
  buildRanking,
  buildVisibleRanking,
  canTransition,
  correctAnswerFor,
  errorMessage,
  isJoinable,
  nextPhase,
  parseNumericInput,
  parseTextInput,
  podiumFrom,
  scoreAnswer,
  toParticipantQuestionView,
  transitionRefusalReason,
  validateNickname,
  type AnswerPayload,
  type FinalRankingView,
  type LiveSessionSettings,
  type RankingRow,
  type QuizSnapshot,
  type SessionPhase,
  type SnapshotQuestion,
  GRACE_MS,
  INTERMEDIATE_RANKING_SIZE,
  SESSION_IDLE_TIMEOUT_MS,
  MAX_JOINS_PER_SECOND_PER_SESSION,
  MAX_PARTICIPANTS_PER_SESSION,
  ENDED_PURGE_DELAY_MS,
} from '@quiz/shared';

interface ParticipantState {
  id: string;
  nickname: string;
  nicknameKey: string;
  tokenHash: string;
  score: number;
  isKicked: boolean;
  connected: boolean;
  socketId: string | null;
  joinedAt: number;
  answers: Map<
    number,
    {
      payload: AnswerPayload;
      isCorrect: boolean | null;
      pointsBase: number;
      pointsBonus: number;
      pointsAwarded: number;
      elapsedMs: number;
    }
  >;
}

interface LiveSessionState {
  sessionId: string;
  code: string;
  presenterId: string;
  joinUrl: string;
  quizSnapshot: QuizSnapshot;
  phase: SessionPhase;
  currentQuestionIndex: number;
  questionOpenedAt: number | null;
  questionClosesAt: number | null;
  startedAt: number | null;
  settings: LiveSessionSettings;
  participants: Map<string, ParticipantState>; // by participantId
  byNickname: Map<string, string>; // nicknameKey → participantId
  timer: NodeJS.Timeout | null;
  /** Ends a session left without join, answer or presenter command for SESSION_IDLE_TIMEOUT_MS. */
  idleTimer: NodeJS.Timeout | null;
  /** Per-session join burst window (MAX_JOINS_PER_SECOND_PER_SESSION). */
  joinWindow: { startedAt: number; count: number };
  /**
   * Final view and ranking, computed once when the run reaches FINAL_RANKING and served to every
   * snapshot from then on (500 phones reconnecting after a restart must not each cost a query and
   * a full ranking). Dropped by anything that changes it: a step back, a reopen, a kick.
   */
  finalCache: { finalView: FinalRankingView; ranking: RankingRow[] } | null;
  mutex: Mutex;
}

const now = () => Date.now();

/** Throttle window of `answers:progress` per session (§6.3). */
const PROGRESS_THROTTLE_MS = 250;

type Refusal = { ok: false; code: string; message: string };
type CommandResult = { ok: true } | Refusal;

/** A refusal with the canonical message of its code: the acks send `errorMessage(code)` anyway. */
const refuse = (code: string): Refusal => ({ ok: false, code, message: errorMessage(code) });

/**
 * The socket's transport closed while a join or resume awaited the database. `disconnected` is
 * also true for a socket still in its handshake, so the engine.io state is what counts there.
 */
function transportGone(socket: Socket): boolean {
  return socket.conn.readyState !== 'open';
}

/** Prisma unique-constraint violation (P2002). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
}

export class SessionManager {
  private readonly sessions = new Map<string, LiveSessionState>();
  private readonly loading = new Map<string, Promise<LiveSessionState | null>>();
  private readonly progress = new Map<string, { lastAt: number; trailing: NodeJS.Timeout | null }>();
  /**
   * Derived views served to every snapshot: the current round result and the ranking. A reconnect
   * storm (500 phones after a restart) must not recompute them per participant. Dropped by anything
   * that changes them (an accepted answer, a step back, a reopen, a kick), like `finalCache`.
   */
  private readonly roundCache = new Map<string, ReturnType<SessionManager['roundResult']>>();
  private readonly rankingCache = new Map<string, RankingRow[]>();
  /** The participants' view of the ranking while a question is open (see `visibleRanking`). */
  private readonly visibleRankingCache = new Map<string, RankingRow[]>();
  /** Sessions being deleted: `getOrLoad` must not rebuild one from a row about to disappear. */
  private readonly deleting = new Set<string>();

  constructor(
    private readonly io: SocketIOServer,
    private readonly prisma: PrismaClient,
    private readonly getPublicUrl: () => string,
    private readonly log: Pick<FastifyBaseLogger, 'error'>,
  ) {}

  // --- Loading -----------------------------------------------------------------

  async getOrLoad(sessionId: string): Promise<LiveSessionState | null> {
    if (this.deleting.has(sessionId)) return null;
    const cached = this.sessions.get(sessionId);
    if (cached) return cached;
    const inflight = this.loading.get(sessionId);
    if (inflight) return inflight;
    // A failed load must not stay cached: the next call retries.
    const promise = this.load(sessionId).finally(() => this.loading.delete(sessionId));
    this.loading.set(sessionId, promise);
    return promise;
  }

  private async load(sessionId: string): Promise<LiveSessionState | null> {
    const session = await this.prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { participants: true, answers: true },
    });
    if (!session) return null;

    const state: LiveSessionState = {
      sessionId: session.id,
      code: session.code,
      presenterId: session.presenterId,
      joinUrl: joinUrl(this.getPublicUrl(), session.code),
      quizSnapshot: session.quizSnapshot as unknown as QuizSnapshot,
      phase: asPhase(session.phase),
      currentQuestionIndex: session.currentQuestionIndex,
      questionOpenedAt: session.questionOpenedAt?.getTime() ?? null,
      questionClosesAt: session.questionClosesAt?.getTime() ?? null,
      startedAt: session.startedAt?.getTime() ?? null,
      settings: session.settings as unknown as LiveSessionSettings,
      participants: new Map(),
      byNickname: new Map(),
      timer: null,
      idleTimer: null,
      joinWindow: { startedAt: 0, count: 0 },
      finalCache: null,
      mutex: new Mutex(),
    };

    for (const p of session.participants) {
      state.participants.set(p.id, {
        id: p.id,
        nickname: p.nickname,
        nicknameKey: p.nicknameKey,
        tokenHash: p.tokenHash,
        score: p.score,
        isKicked: p.isKicked,
        connected: false,
        socketId: null,
        joinedAt: p.joinedAt.getTime(),
        answers: new Map(),
      });
      state.byNickname.set(p.nicknameKey, p.id);
    }
    for (const a of session.answers) {
      const p = state.participants.get(a.participantId);
      if (!p) continue;
      p.answers.set(a.questionIndex, {
        payload: a.payload as unknown as AnswerPayload,
        isCorrect: a.isCorrect,
        pointsBase: a.pointsBase,
        pointsBonus: a.pointsBonus,
        pointsAwarded: a.pointsAwarded,
        elapsedMs: a.elapsedMs,
      });
    }

    this.sessions.set(sessionId, state);
    if (state.phase === 'ENDED') {
      // Loaded after its purge (late disconnect, history page): rebuilt for this call only, then
      // dropped again, so ended sessions never accumulate in memory.
      setTimeout(() => this.forget(sessionId), ENDED_PURGE_DELAY_MS).unref?.();
    } else {
      this.armIdleTimer(state);
    }

    // Re-arm the timer for a question open at boot (or close it immediately if past).
    if (state.phase === 'QUESTION_OPEN' && state.questionClosesAt !== null) {
      const q = this.questionAt(state);
      if (q?.timeLimitSec) this.armCloseTimer(state, state.questionClosesAt + GRACE_MS - now());
    }
    return state;
  }

  /**
   * Boot-time eager load of every session that is not over: re-arms the close timer of an open
   * timed question (§6.5 rule 2) and the idle timer of everything else, so a lobby or a run
   * abandoned before a restart is still evicted instead of blocking its quiz forever.
   */
  async loadAllOpen(): Promise<void> {
    const open = await this.prisma.liveSession.findMany({
      where: { phase: { not: 'ENDED' } },
      select: { id: true },
    });
    for (const s of open) await this.getOrLoad(s.id);
  }

  // --- Accessors -----------------------------------------------------------------

  questionAt(s: LiveSessionState): SnapshotQuestion | null {
    return s.quizSnapshot.questions[s.currentQuestionIndex] ?? null;
  }

  aliveParticipants(s: LiveSessionState): ParticipantState[] {
    return [...s.participants.values()].filter((p) => !p.isKicked);
  }

  ranking(s: LiveSessionState) {
    return buildRanking(this.aliveParticipants(s).map(toStatsParticipant), [...pAnswers(s)]);
  }

  private cachedRanking(s: LiveSessionState): RankingRow[] {
    let ranking = this.rankingCache.get(s.sessionId);
    if (!ranking) {
      ranking = this.ranking(s);
      this.rankingCache.set(s.sessionId, ranking);
    }
    return ranking;
  }

  /**
   * The ranking a participant may see: while a question is open, without its points and answer
   * times (shared `buildVisibleRanking`), so a resume snapshot is no oracle of an answer's
   * correctness before `question:closed`. Otherwise the live ranking. The presenter keeps the live one.
   */
  private visibleRanking(s: LiveSessionState): RankingRow[] {
    if (s.phase !== 'QUESTION_OPEN') return this.cachedRanking(s);
    let ranking = this.visibleRankingCache.get(s.sessionId);
    if (!ranking) {
      ranking = buildVisibleRanking(
        this.aliveParticipants(s).map(toStatsParticipant),
        [...pAnswers(s)],
        s.currentQuestionIndex,
      );
      this.visibleRankingCache.set(s.sessionId, ranking);
    }
    return ranking;
  }

  private cachedRoundResult(s: LiveSessionState): ReturnType<SessionManager['roundResult']> {
    let result = this.roundCache.get(s.sessionId);
    if (!result) {
      result = this.roundResult(s);
      this.roundCache.set(s.sessionId, result);
    }
    return result;
  }

  /** Every derived view is stale: the answers, the participants or the question changed. */
  private invalidateDerived(s: LiveSessionState): void {
    this.roundCache.delete(s.sessionId);
    this.invalidateRankings(s.sessionId);
    s.finalCache = null;
  }

  /** Both ranking caches (full and answer-secret) go stale together. */
  private invalidateRankings(sessionId: string): void {
    this.rankingCache.delete(sessionId);
    this.visibleRankingCache.delete(sessionId);
  }

  // --- Join / resume ----------------------------------------------------------------

  async join(
    socket: Socket,
    code: string,
    rawNickname: string,
  ): Promise<{ ok: true; participant: ParticipantState; s: LiveSessionState; token: string } | Refusal> {
    const session = await this.prisma.liveSession.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, phase: true },
    });
    if (!session) return refuse('SESSION_NOT_FOUND');
    // Checked on the row first: an ENDED session is not rebuilt in memory just to be refused.
    // The check under the lock below still decides for a session that is loaded.
    if (!isJoinable(asPhase(session.phase))) return refuse('SESSION_CLOSED_TO_JOIN');
    const s = await this.getOrLoad(session.id);
    if (!s) return refuse('SESSION_NOT_FOUND');

    const validation = validateNickname(rawNickname);
    if (!validation.ok) return { ok: false, code: validation.code, message: validation.message };

    // Under the lock: two simultaneous joins with the same nickname are checked one after the other,
    // so the second one gets NICKNAME_TAKEN instead of hitting the (sessionId, nicknameKey) constraint.
    const result = await s.mutex.runExclusive(async () => {
      if (!isJoinable(s.phase)) return refuse('SESSION_CLOSED_TO_JOIN');
      if (s.byNickname.has(validation.key)) return refuse('NICKNAME_TAKEN');
      if (this.aliveParticipants(s).length >= MAX_PARTICIPANTS_PER_SESSION) return refuse('SESSION_FULL');
      // Per-session join burst (§6.7): the per-socket limiter cannot see a room-wide stampede.
      const nowMs = now();
      if (nowMs - s.joinWindow.startedAt >= 1000) s.joinWindow = { startedAt: nowMs, count: 0 };
      if (s.joinWindow.count >= MAX_JOINS_PER_SECOND_PER_SESSION) return refuse('RATE_LIMITED');
      s.joinWindow.count += 1;

      const token = randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      const participant: ParticipantState = {
        id: randomUUID(),
        nickname: validation.nickname,
        nicknameKey: validation.key,
        tokenHash,
        score: 0,
        isKicked: false,
        connected: true,
        socketId: socket.id,
        joinedAt: now(),
        answers: new Map(),
      };
      // Durable write first — memory only reflects what the database accepted.
      let row;
      try {
        row = await this.prisma.participant.create({
          data: {
            sessionId: s.sessionId,
            nickname: participant.nickname,
            nicknameKey: participant.nicknameKey,
            tokenHash,
            joinedAt: new Date(participant.joinedAt),
          },
        });
      } catch (err) {
        if (isUniqueViolation(err)) return refuse('NICKNAME_TAKEN');
        throw err;
      }
      participant.id = row.id;
      s.participants.set(participant.id, participant);
      s.byNickname.set(participant.nicknameKey, participant.id);
      // A new row in the ranking the snapshots rank against (the stored round result keeps its own).
      this.invalidateRankings(s.sessionId);

      socket.join(participantsRoom(s.sessionId));
      socket.data.sessionId = s.sessionId;
      socket.data.participantId = participant.id;

      this.broadcastParticipantsList(s);
      if (s.phase === 'LOBBY') this.broadcastLobbyCount(s);
      this.armIdleTimer(s); // a join is activity
      return { ok: true, participant, s, token } as const;
    });
    // A transport dropped while the create was pending fired `disconnect` before
    // `socket.data.participantId` existed: nobody else will ever mark this seat offline.
    if (result.ok && transportGone(socket)) this.markDisconnected(s, result.participant.id, socket.id);
    return result;
  }

  async resumeByToken(
    socket: Socket,
    token: string,
  ): Promise<{ ok: true; participant: ParticipantState; s: LiveSessionState } | Refusal> {
    const tokenHash = sha256(token);
    const row = await this.prisma.participant.findUnique({
      where: { tokenHash },
      include: { session: { select: { id: true, phase: true } } },
    });
    if (!row) return { ok: false, code: 'TOKEN_INVALID', message: 'Session expirée' };
    if (row.isKicked) return { ok: false, code: 'KICKED', message: 'Vous avez été retiré de la session' };
    if (row.session.phase === 'ENDED')
      return { ok: false, code: 'SESSION_ENDED', message: 'La session est terminée' };

    const s = await this.getOrLoad(row.sessionId);
    if (!s) return { ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' };

    const result = await s.mutex.runExclusive(() => {
      const participant = s.participants.get(row.id);
      if (!participant) return { ok: false, code: 'TOKEN_INVALID', message: 'Session expirée' } as const;
      if (participant.isKicked)
        return { ok: false, code: 'KICKED', message: 'Vous avez été retiré de la session' } as const;

      // Single active connection per participant: the new one replaces the old.
      const previousSocketId = participant.socketId;
      if (previousSocketId && previousSocketId !== socket.id) {
        const previous = this.participantNs().sockets.get(previousSocketId);
        if (previous) {
          previous.emit('participant:replaced');
          previous.disconnect(true);
        }
      }
      participant.connected = true;
      participant.socketId = socket.id;
      socket.join(participantsRoom(s.sessionId));
      socket.data.sessionId = s.sessionId;
      socket.data.participantId = participant.id;
      this.broadcastParticipantsList(s);
      return { ok: true, participant, s } as const;
    });
    // Still in the handshake: a client gone before `next()` is cleaned up by socket.io without a
    // `disconnect` event, so the presence set above would stand for good.
    if (result.ok && transportGone(socket)) this.markDisconnected(s, result.participant.id, socket.id);
    return result;
  }

  // --- Answers ----------------------------------------------------------------------

  async submitAnswer(
    s: LiveSessionState,
    participant: ParticipantState,
    questionIndex: number,
    answer: { choiceId?: string; value?: string; text?: string },
  ): Promise<{ ok: true; answeredAt: number } | Refusal> {
    // Arrival time, taken before waiting for the lock: the grace window and the speed bonus
    // must not depend on how many answers are queued ahead of this one.
    const receivedAt = now();
    // The opening this answer was sent to, also read before the lock: queued behind a close +
    // reopen (or a next), it must not be scored against a later opening, where `elapsedMs` would
    // clamp to 0 and earn the full speed bonus.
    const opening = { open: s.phase === 'QUESTION_OPEN', openedAt: s.questionOpenedAt };
    // Under the lock: a close cannot slip between the phase check and the durable write,
    // so every accepted answer is part of the round result it belongs to.
    return s.mutex.runExclusive(() =>
      this.recordAnswer(s, participant, questionIndex, answer, receivedAt, opening),
    );
  }

  private async recordAnswer(
    s: LiveSessionState,
    participant: ParticipantState,
    questionIndex: number,
    answer: { choiceId?: string; value?: string; text?: string },
    receivedAt: number,
    opening: { open: boolean; openedAt: number | null },
  ): Promise<{ ok: true; answeredAt: number } | Refusal> {
    if (participant.isKicked) return refuse('KICKED');
    if (s.phase !== 'QUESTION_OPEN') return refuse('QUESTION_CLOSED');
    if (questionIndex !== s.currentQuestionIndex) return refuse('WRONG_QUESTION');
    // Sent while nothing was open, or to an opening that has since been closed and replaced.
    if (!opening.open || opening.openedAt !== s.questionOpenedAt) return refuse('QUESTION_CLOSED');
    if (participant.answers.has(questionIndex)) return refuse('ALREADY_ANSWERED');

    const q = this.questionAt(s);
    if (!q) return refuse('INTERNAL');

    // Late-answer grace (§4.3): reject past closesAt + GRACE_MS.
    if (s.questionClosesAt !== null && receivedAt > s.questionClosesAt + GRACE_MS) {
      return refuse('QUESTION_CLOSED');
    }

    let payload: AnswerPayload;
    if (q.type === 'NUMERIC') {
      const parsed = parseNumericInput(String(answer?.value ?? ''));
      if (!parsed.ok) return { ok: false, code: 'INVALID_NUMBER', message: parsed.message };
      payload = { value: parsed.value };
    } else if (q.type === 'TEXT_POLL') {
      const parsed = parseTextInput(String(answer?.text ?? ''));
      if (!parsed.ok) return { ok: false, code: 'INVALID_TEXT', message: parsed.message };
      payload = { text: parsed.text };
    } else {
      const choiceId = String(answer?.choiceId ?? '');
      if (!q.choices.some((c) => c.id === choiceId)) return refuse('INVALID_CHOICE');
      payload = { choiceId };
    }

    const elapsedMs = Math.max(0, receivedAt - (s.questionOpenedAt ?? receivedAt));
    const score = scoreAnswer(q, payload, elapsedMs);

    // Durable transaction: Answer + score cache. Memory only on success.
    try {
      await this.prisma.$transaction([
        this.prisma.answer.create({
          data: {
            sessionId: s.sessionId,
            participantId: participant.id,
            questionId: q.id,
            questionIndex,
            payload: payload as unknown as object,
            isCorrect: score.isCorrect,
            pointsBase: score.pointsBase,
            pointsBonus: score.pointsBonus,
            pointsAwarded: score.pointsAwarded,
            elapsedMs,
          },
        }),
        this.prisma.participant.update({
          where: { id: participant.id },
          data: { score: { increment: score.pointsAwarded }, lastSeenAt: new Date() },
        }),
      ]);
    } catch (err) {
      this.log.error(
        { err, sessionId: s.sessionId, participantId: participant.id, questionIndex },
        'answer persistence failed',
      );
      return refuse('INTERNAL');
    }

    this.invalidateDerived(s);
    participant.score += score.pointsAwarded;
    participant.answers.set(questionIndex, {
      payload,
      isCorrect: score.isCorrect,
      pointsBase: score.pointsBase,
      pointsBonus: score.pointsBonus,
      pointsAwarded: score.pointsAwarded,
      elapsedMs,
    });

    this.emitAnswersProgress(s);
    this.armIdleTimer(s); // an answer is activity
    return { ok: true, answeredAt: now() };
  }

  // --- Presenter commands --------------------------------------------------------------

  async startSession(s: LiveSessionState, force: boolean): Promise<CommandResult> {
    return s.mutex.runExclusive(async () => {
      const ctx = { ...this.transitionContext(s), force };
      if (!canTransition(s.phase, 'session:start', ctx)) {
        return refuse(transitionRefusalReason(s.phase, 'session:start', ctx) ?? 'INVALID_PHASE');
      }
      // One write for the whole transition: a first update to QUESTION_OPEN followed by a failed
      // openQuestion would leave phase OPEN at index -1, which no command can recover from.
      const startedAt = now();
      await this.openQuestion(s, 0, { startedAt: new Date(startedAt) });
      s.startedAt = startedAt;
      return { ok: true };
    });
  }

  async closeQuestionCommand(s: LiveSessionState, expectedIndex: number): Promise<CommandResult> {
    return s.mutex.runExclusive(async () => {
      if (expectedIndex !== s.currentQuestionIndex) return refuse('INDEX_MISMATCH');
      if (s.phase !== 'QUESTION_OPEN') return refuse('INVALID_PHASE');
      await this.closeQuestion(s);
      this.armIdleTimer(s);
      return { ok: true };
    });
  }

  async nextQuestion(s: LiveSessionState, expectedIndex: number): Promise<CommandResult> {
    return s.mutex.runExclusive(async () => {
      if (expectedIndex !== s.currentQuestionIndex) return refuse('INDEX_MISMATCH');
      const ctx = this.transitionContext(s);
      if (!canTransition(s.phase, 'question:next', ctx)) return refuse('INVALID_PHASE');
      const target = nextPhase(s.phase, 'question:next', ctx)!;
      if (target === 'QUESTION_OPEN') {
        await this.openQuestion(s, s.currentQuestionIndex + 1);
      } else {
        await this.enterFinalRanking(s);
      }
      return { ok: true };
    });
  }

  /**
   * From an open question back to the previous result screen. The open question's answers are
   * discarded (scores rolled back), then the previous round result is re-sent to both audiences.
   */
  async previousQuestion(s: LiveSessionState, expectedIndex: number): Promise<CommandResult> {
    return s.mutex.runExclusive(async () => {
      if (expectedIndex !== s.currentQuestionIndex) return refuse('INDEX_MISMATCH');
      if (!canTransition(s.phase, 'question:back', this.transitionContext(s))) return refuse('INVALID_PHASE');
      const index = s.currentQuestionIndex - 1;
      await this.discardAnswers(s, s.currentQuestionIndex, {
        phase: 'QUESTION_CLOSED',
        currentQuestionIndex: index,
        questionOpenedAt: null,
        questionClosesAt: null,
      });
      s.phase = 'QUESTION_CLOSED';
      s.currentQuestionIndex = index;
      s.questionOpenedAt = null;
      s.questionClosesAt = null;
      // Only now that the write committed: a failed transaction must leave the open timed question
      // with its auto-close, not phase OPEN and no timer.
      this.clearCloseTimer(s);
      this.invalidateDerived(s);
      this.armIdleTimer(s);
      this.emitRoundResult(s);
      return { ok: true };
    });
  }

  /**
   * From a result screen back to its question, reopened with a fresh timer. Its answers and its
   * stored result are discarded (scores rolled back): the round is played again from scratch.
   */
  async reopenQuestion(s: LiveSessionState, expectedIndex: number): Promise<CommandResult> {
    return s.mutex.runExclusive(async () => {
      if (expectedIndex !== s.currentQuestionIndex) return refuse('INDEX_MISMATCH');
      if (!canTransition(s.phase, 'question:reopen', this.transitionContext(s)))
        return refuse('INVALID_PHASE');
      await this.discardAnswers(s, s.currentQuestionIndex);
      await this.openQuestion(s, s.currentQuestionIndex);
      this.broadcastParticipantsList(s);
      return { ok: true };
    });
  }

  private transitionContext(s: LiveSessionState) {
    return {
      participantCount: this.aliveParticipants(s).length,
      currentQuestionIndex: s.currentQuestionIndex,
      lastIndex: s.quizSnapshot.questions.length - 1,
    };
  }

  /** Ends the run — presenter command or REST fallback. Idempotent. */
  async endSession(s: LiveSessionState): Promise<{ ok: true }> {
    return s.mutex.runExclusive(async () => {
      if (s.phase === 'ENDED') return { ok: true };
      await this.prisma.liveSession.update({
        where: { id: s.sessionId },
        data: { phase: 'ENDED', endedAt: new Date() },
      });
      this.shutdown(s);
      setTimeout(() => this.forget(s.sessionId), ENDED_PURGE_DELAY_MS).unref?.();
      return { ok: true };
    });
  }

  /**
   * Deletes a session and all its data (RGPD). A loaded session is stopped under its lock first,
   * so no timer or in-flight command writes against the deleted row afterwards. While the delete
   * runs, `getOrLoad` answers null: a session that is not loaded cannot be rebuilt from the row
   * being deleted and left behind in memory as a ghost with its timers.
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.deleting.add(sessionId);
    try {
      // A load that started before the flag is awaited: it is then stopped under its lock.
      const s = this.sessions.get(sessionId) ?? (await this.loading.get(sessionId)) ?? null;
      if (!s) {
        await this.prisma.liveSession.delete({ where: { id: sessionId } });
        return;
      }
      await s.mutex.runExclusive(async () => {
        await this.prisma.liveSession.delete({ where: { id: sessionId } });
        if (s.phase !== 'ENDED') this.shutdown(s);
        this.forget(sessionId);
      });
    } finally {
      this.deleting.delete(sessionId);
    }
  }

  async kick(s: LiveSessionState, participantId: string): Promise<CommandResult> {
    return s.mutex.runExclusive(async () => {
      const p = s.participants.get(participantId);
      if (!p || p.isKicked) return refuse('NOT_FOUND');
      await this.prisma.participant.update({ where: { id: participantId }, data: { isKicked: true } });
      p.isKicked = true;
      this.invalidateDerived(s); // the ranking no longer counts them
      this.armIdleTimer(s);
      if (p.socketId) {
        const socket = this.participantNs().sockets.get(p.socketId);
        socket?.emit('participant:kicked', { message: 'Vous avez été retiré de la session' });
        socket?.disconnect(true);
      }
      // nicknameKey stays reserved; tokenHash kept → resume answers KICKED.
      this.broadcastParticipantsList(s);
      if (s.phase === 'LOBBY') this.broadcastLobbyCount(s);
      return { ok: true } as const;
    });
  }

  async updateSettings(
    s: LiveSessionState,
    patch: Partial<LiveSessionSettings>,
  ): Promise<LiveSessionSettings> {
    return s.mutex.runExclusive(async () => {
      const settings = { ...s.settings, ...patch };
      await this.prisma.liveSession.update({
        where: { id: s.sessionId },
        data: { settings: settings as unknown as object },
      });
      s.settings = settings;
      this.armIdleTimer(s);
      this.presenterNs().to(presenterRoom(s.sessionId)).emit('settings:changed', s.settings);
      return s.settings;
    });
  }

  /** Stops the hot state (timer, phase) and tells both audiences. Mutex held. */
  private shutdown(s: LiveSessionState): void {
    this.clearCloseTimer(s);
    this.clearIdleTimer(s);
    s.phase = 'ENDED';
    const reason = s.startedAt !== null ? 'ENDED' : 'CANCELLED';
    this.presenterNs().to(presenterRoom(s.sessionId)).emit('session:ended', { reason });
    this.participantNs().to(participantsRoom(s.sessionId)).emit('session:ended', { reason });
  }

  /** Drops a session's hot state; the next getOrLoad reads it back from the database. */
  private forget(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (s) this.clearIdleTimer(s);
    this.sessions.delete(sessionId);
    this.roundCache.delete(sessionId);
    this.invalidateRankings(sessionId);
    const progress = this.progress.get(sessionId);
    if (progress?.trailing) clearTimeout(progress.trailing);
    this.progress.delete(sessionId);
  }

  /**
   * Idle eviction: a session left without join, answer or presenter command for
   * SESSION_IDLE_TIMEOUT_MS is ended (CANCELLED when it never started), which also drops it from
   * memory after the usual purge delay. A lobby nobody starts and a run whose presenter closed the
   * tab without ending it both stop blocking the quiz (archive, history) and the process memory.
   */
  private armIdleTimer(s: LiveSessionState): void {
    this.clearIdleTimer(s);
    s.idleTimer = setTimeout(() => {
      s.idleTimer = null;
      if (this.sessions.get(s.sessionId) !== s || s.phase === 'ENDED') return;
      this.endSession(s).catch((err: unknown) =>
        this.log.error({ err, sessionId: s.sessionId }, 'idle session eviction failed'),
      );
    }, SESSION_IDLE_TIMEOUT_MS);
    s.idleTimer.unref?.();
  }

  private clearIdleTimer(s: LiveSessionState): void {
    if (s.idleTimer) clearTimeout(s.idleTimer);
    s.idleTimer = null;
  }

  // --- Question lifecycle (mutex held) ----------------------------------------------------

  private async openQuestion(
    s: LiveSessionState,
    index: number,
    extra: { startedAt?: Date } = {},
  ): Promise<void> {
    // Write first, then mutate: a failed write must leave memory and timers on the previous
    // question, so the presenter can retry with the same expectedIndex.
    const q = s.quizSnapshot.questions[index]!;
    const openedAt = now();
    const closesAt = q.timeLimitSec ? openedAt + q.timeLimitSec * 1000 : null;

    await this.prisma.liveSession.update({
      where: { id: s.sessionId },
      data: {
        ...extra,
        phase: 'QUESTION_OPEN',
        currentQuestionIndex: index,
        questionOpenedAt: new Date(openedAt),
        questionClosesAt: closesAt ? new Date(closesAt) : null,
      },
    });
    s.currentQuestionIndex = index;
    s.phase = 'QUESTION_OPEN';
    s.questionOpenedAt = openedAt;
    s.questionClosesAt = closesAt;
    this.invalidateDerived(s);
    this.armIdleTimer(s); // a presenter command is activity

    if (s.questionClosesAt !== null) this.armCloseTimer(s, s.questionClosesAt - now() + GRACE_MS);

    const base = {
      questionIndex: index,
      totalQuestions: s.quizSnapshot.questions.length,
      openedAt: s.questionOpenedAt,
      closesAt: s.questionClosesAt,
      serverTime: now(),
    };
    this.presenterNs()
      .to(presenterRoom(s.sessionId))
      .emit('question:open', { view: q, ...base });
    this.participantNs()
      .to(participantsRoom(s.sessionId))
      .emit('question:open', {
        view: toParticipantQuestionView(q), // LEAK BOUNDARY: no isCorrect / numericAnswer
        ...base,
      });
    this.emitPhase(s);
  }

  /**
   * Auto-close at closesAt + GRACE_MS. The callback takes the lock like any command; by the time it
   * gets it, a manual close, a reopen (same index, new opening) or the next question may already have
   * run: it only closes the very opening it was armed for.
   */
  private clearCloseTimer(s: LiveSessionState): void {
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;
  }

  private armCloseTimer(s: LiveSessionState, delayMs: number): void {
    this.clearCloseTimer(s);
    const index = s.currentQuestionIndex;
    const openedAt = s.questionOpenedAt;
    s.timer = setTimeout(
      () => {
        s.mutex
          .runExclusive(async () => {
            if (s.currentQuestionIndex === index && s.questionOpenedAt === openedAt) {
              await this.closeQuestion(s);
            }
          })
          .catch((err: unknown) => this.log.error({ err, sessionId: s.sessionId }, 'auto-close failed'));
      },
      Math.max(0, delayMs),
    );
  }

  /**
   * Deletes every answer to question `index` and its stored result, rolls the score caches back,
   * and applies `sessionPatch` in the same transaction. Memory only follows a committed write.
   */
  private async discardAnswers(
    s: LiveSessionState,
    index: number,
    sessionPatch?: {
      phase: SessionPhase;
      currentQuestionIndex: number;
      questionOpenedAt: null;
      questionClosesAt: null;
    },
  ): Promise<void> {
    const answered = [...s.participants.values()].filter((p) => p.answers.has(index));
    await this.prisma.$transaction([
      this.prisma.answer.deleteMany({ where: { sessionId: s.sessionId, questionIndex: index } }),
      this.prisma.questionResult.deleteMany({ where: { sessionId: s.sessionId, questionIndex: index } }),
      ...answered.map((p) =>
        this.prisma.participant.update({
          where: { id: p.id },
          data: { score: { decrement: p.answers.get(index)!.pointsAwarded } },
        }),
      ),
      ...(sessionPatch
        ? [this.prisma.liveSession.update({ where: { id: s.sessionId }, data: sessionPatch })]
        : []),
    ]);
    for (const p of answered) {
      p.score -= p.answers.get(index)!.pointsAwarded;
      p.answers.delete(index);
    }
    this.invalidateDerived(s);
  }

  /**
   * Round result of the current question, computed from the hot state: what `closeQuestion` stores
   * and sends, and what a reconnection or a step back re-sends. Nothing is answered after a close,
   * so recomputing gives the same result as at close time.
   */
  private roundResult(s: LiveSessionState) {
    const q = this.questionAt(s)!;
    const index = s.currentQuestionIndex;

    const alive = this.aliveParticipants(s);
    const aliveCount = alive.length;
    const answerRows = alive
      .filter((p) => p.answers.has(index))
      .map((p) => ({ p, a: p.answers.get(index)! }));
    const correctRows = answerRows.filter(({ a }) => a.isCorrect === true);
    const correctCount = correctRows.length;

    // Distribution + aggregates. A TEXT_POLL's grouped answers also go to every participant.
    const distribution = buildQuestionDistribution(
      q,
      answerRows.map(({ a }) => a),
      correctCount,
    );
    const textEntries = distribution.kind === 'TEXT' ? distribution.entries : null;
    const fastest = correctRows.sort((x, y) => x.a.elapsedMs - y.a.elapsedMs)[0];
    const fastestCorrect = fastest
      ? { participantId: fastest.p.id, nickname: fastest.p.nickname, elapsedMs: fastest.a.elapsedMs }
      : null;
    const correctAnswer = correctAnswerFor(q);

    const ranking = this.cachedRanking(s);
    const rankOf = new Map(ranking.map((r) => [r.participantId, r.rank]));

    return {
      q,
      index,
      aliveCount,
      answerRows,
      correctCount,
      distribution,
      fastestCorrect,
      presenter: {
        questionIndex: index,
        correctAnswer,
        answersCount: answerRows.length,
        correctCount,
        distribution,
        answers: answerRows.map(({ p, a }) => ({
          participantId: p.id,
          nickname: p.nickname,
          payload: a.payload,
          isCorrect: a.isCorrect,
          pointsBase: a.pointsBase,
          pointsBonus: a.pointsBonus,
          pointsAwarded: a.pointsAwarded,
          elapsedMs: a.elapsedMs,
        })),
        fastestCorrect,
        top5: ranking.slice(0, INTERMEDIATE_RANKING_SIZE).map(toRankingEntry),
        previousRanks: Object.fromEntries(rankOf),
      },
      /** Individualised result of one participant (§6.5 rule 4): never the others' detail. */
      forParticipant: (p: ParticipantState) => {
        const a = p.answers.get(index);
        return {
          questionIndex: index,
          correctAnswer,
          yourAnswer: a?.payload ?? null,
          isCorrect: a?.isCorrect ?? null,
          pointsBase: a?.pointsBase ?? 0,
          pointsBonus: a?.pointsBonus ?? 0,
          pointsAwarded: a?.pointsAwarded ?? 0,
          totalScore: p.score,
          rank: rankOf.get(p.id) ?? aliveCount,
          participantCount: aliveCount,
          textEntries,
        };
      },
    };
  }

  private async closeQuestion(s: LiveSessionState): Promise<void> {
    if (s.phase !== 'QUESTION_OPEN') return;
    // Computed under the lock from memory only: no answer can land between here and the commit.
    const result = this.roundResult(s);
    const { q, index, aliveCount, answerRows, correctCount, distribution, fastestCorrect } = result;

    await this.prisma.$transaction([
      this.prisma.questionResult.create({
        data: {
          sessionId: s.sessionId,
          questionId: q.id,
          questionIndex: index,
          participantsAtClose: aliveCount,
          answersCount: answerRows.length,
          correctCount,
          distribution: distribution as object,
          fastestCorrect: fastestCorrect ?? undefined,
          closedAt: new Date(),
        },
      }),
      this.prisma.liveSession.update({
        where: { id: s.sessionId },
        data: { phase: 'QUESTION_CLOSED', questionClosesAt: new Date(now()) },
      }),
    ]);
    // Only now that the write committed: a failed transaction must leave the timed question open
    // with its auto-close armed, not phase OPEN and no timer (same rule as previousQuestion).
    this.clearCloseTimer(s);
    this.roundCache.set(s.sessionId, result);
    s.phase = 'QUESTION_CLOSED';
    this.emitRoundResult(s, result);
  }

  /**
   * Sends the current round result: full view to the presenter, one result per participant, then
   * the participants list so the presenter's panel shows the scores including this round.
   */
  private emitRoundResult(s: LiveSessionState, result = this.cachedRoundResult(s)): void {
    this.presenterNs()
      .to(presenterRoom(s.sessionId))
      .emit('question:closed', { audience: 'presenter', result: result.presenter });
    // Participants: individualised results (io.to(socketId) per §6.5 rule 4).
    for (const p of this.aliveParticipants(s)) {
      if (p.socketId) {
        this.participantNs()
          .to(p.socketId)
          .emit('question:closed', { audience: 'participant', result: result.forParticipant(p) });
      }
    }
    this.broadcastParticipantsList(s);
    this.emitPhase(s);
  }

  private async enterFinalRanking(s: LiveSessionState): Promise<void> {
    await this.prisma.liveSession.update({ where: { id: s.sessionId }, data: { phase: 'FINAL_RANKING' } });
    s.phase = 'FINAL_RANKING';
    this.armIdleTimer(s);

    const { finalView, ranking } = await this.finalRanking(s);
    this.presenterNs()
      .to(presenterRoom(s.sessionId))
      .emit('session:final', { audience: 'presenter', final: finalView });
    for (const p of this.aliveParticipants(s)) {
      if (p.socketId) {
        this.participantNs()
          .to(p.socketId)
          .emit('session:final', { audience: 'participant', final: participantFinal(finalView, ranking, p) });
      }
    }
    this.emitPhase(s);
  }

  /** Final ranking and stats, from the hot state and the stored round results. Cached on the state. */
  private async finalRanking(s: LiveSessionState): Promise<NonNullable<LiveSessionState['finalCache']>> {
    if (s.finalCache) return s.finalCache;
    const participantsStat = this.aliveParticipants(s).map(toStatsParticipant);
    const answers = [...pAnswers(s)];
    const ranking = this.cachedRanking(s);
    const questionResults = await this.prisma.questionResult.findMany({
      where: { sessionId: s.sessionId },
      orderBy: { questionIndex: 'asc' },
    });
    const stats = buildFinalStats(
      s.quizSnapshot.questions,
      questionResults.map((r) => ({
        questionIndex: r.questionIndex,
        participantsAtClose: r.participantsAtClose,
        answersCount: r.answersCount,
        correctCount: r.correctCount,
      })),
      answers,
      participantsStat,
    );

    const finalView = {
      podium: podiumFrom(ranking),
      ranking: ranking.map(toRankingEntry),
      stats,
    };
    s.finalCache = { finalView, ranking };
    return s.finalCache;
  }

  // --- Presence & broadcasts ---------------------------------------------------------

  /** `socketId` is the socket that closed: a socket already replaced by a resume changes nothing. */
  markDisconnected(s: LiveSessionState, participantId: string, socketId: string): void {
    const p = s.participants.get(participantId);
    if (!p || p.socketId !== socketId) return;
    p.connected = false;
    p.socketId = null;
    this.broadcastParticipantsList(s);
  }

  private emitPhase(s: LiveSessionState): void {
    const payload = { phase: s.phase, questionIndex: s.currentQuestionIndex, serverTime: now() };
    this.presenterNs().to(presenterRoom(s.sessionId)).emit('session:phase', payload);
    this.participantNs().to(participantsRoom(s.sessionId)).emit('session:phase', payload);
  }

  private broadcastParticipantsList(s: LiveSessionState): void {
    const list = this.aliveParticipants(s).map(toParticipantInfo);
    this.presenterNs()
      .to(presenterRoom(s.sessionId))
      .emit('participants:list', { participants: list, count: list.length });
  }

  private broadcastLobbyCount(s: LiveSessionState): void {
    this.participantNs()
      .to(participantsRoom(s.sessionId))
      .emit('lobby:count', { count: this.aliveParticipants(s).length });
  }

  /**
   * Throttled per session (§6.3) with a trailing emit: an answer landing inside the window is
   * sent when the window ends, so the gauge always reaches the final count.
   */
  private emitAnswersProgress(s: LiveSessionState): void {
    let entry = this.progress.get(s.sessionId);
    if (!entry) {
      entry = { lastAt: 0, trailing: null };
      this.progress.set(s.sessionId, entry);
    }
    if (entry.trailing) return; // the pending emit will read the fresh state
    const wait = entry.lastAt + PROGRESS_THROTTLE_MS - now();
    if (wait <= 0) {
      this.sendAnswersProgress(s, entry);
      return;
    }
    const pending = entry;
    pending.trailing = setTimeout(() => {
      pending.trailing = null;
      this.sendAnswersProgress(s, pending);
    }, wait);
    pending.trailing.unref?.();
  }

  private sendAnswersProgress(s: LiveSessionState, entry: { lastAt: number }): void {
    entry.lastAt = now();
    if (s.phase !== 'QUESTION_OPEN') return;
    const index = s.currentQuestionIndex;
    const alive = this.aliveParticipants(s);
    const answeredList = alive.filter((p) => p.answers.has(index));
    // Latest answers first: every elapsedMs is measured from the same question opening.
    const recent = answeredList
      .sort((a, b) => b.answers.get(index)!.elapsedMs - a.answers.get(index)!.elapsedMs)
      .slice(0, 5)
      .map((p) => p.nickname);
    this.presenterNs()
      .to(presenterRoom(s.sessionId))
      .emit('answers:progress', {
        questionIndex: index,
        answered: answeredList.length,
        connected: alive.filter((p) => p.connected).length,
        total: alive.length,
        recent,
        answeredIds: this.answeredIds(s),
      });
  }

  /** Alive participants who answered the current question, first answer first. */
  private answeredIds(s: LiveSessionState): string[] {
    const index = s.currentQuestionIndex;
    return answeredInOrder(
      this.aliveParticipants(s).map((p) => ({ id: p.id, elapsedMs: p.answers.get(index)?.elapsedMs })),
    );
  }

  // --- Snapshots ----------------------------------------------------------------------

  /**
   * Full presenter state. The round result and the final ranking are rebuilt too: a presenter
   * reopening a session left on a result screen would otherwise wait for an event already sent.
   */
  async presenterSnapshot(s: LiveSessionState) {
    const q = this.questionAt(s);
    const alive = this.aliveParticipants(s);
    return {
      sessionId: s.sessionId,
      code: s.code,
      joinUrl: s.joinUrl,
      quizTitle: s.quizSnapshot.title,
      phase: s.phase,
      questionIndex: s.currentQuestionIndex,
      totalQuestions: s.quizSnapshot.questions.length,
      settings: s.settings,
      participants: alive.map(toParticipantInfo),
      question:
        q && s.phase === 'QUESTION_OPEN'
          ? {
              view: q,
              openedAt: s.questionOpenedAt ?? now(),
              closesAt: s.questionClosesAt,
              answered: alive.filter((p) => p.answers.has(s.currentQuestionIndex)).length,
              answeredIds: this.answeredIds(s),
              connected: alive.filter((p) => p.connected).length,
            }
          : null,
      roundResult: q && s.phase === 'QUESTION_CLOSED' ? this.cachedRoundResult(s).presenter : null,
      final: s.phase === 'FINAL_RANKING' ? (await this.finalRanking(s)).finalView : null,
      serverTime: now(),
    };
  }

  async participantSnapshot(s: LiveSessionState, p: ParticipantState) {
    const q = this.questionAt(s);
    // Answer secrecy: during QUESTION_OPEN, score and rank leave the open question's points out.
    const ranking = this.visibleRanking(s);
    const row = ranking.find((r) => r.participantId === p.id);
    const rank = row?.rank ?? ranking.length;
    const answer = q ? p.answers.get(s.currentQuestionIndex) : undefined;
    const pending = s.phase === 'QUESTION_OPEN' ? (answer?.pointsAwarded ?? 0) : 0;
    return {
      sessionId: s.sessionId,
      code: s.code,
      quizTitle: s.quizSnapshot.title,
      phase: s.phase,
      questionIndex: s.currentQuestionIndex,
      totalQuestions: s.quizSnapshot.questions.length,
      you: { participantId: p.id, nickname: p.nickname, score: row?.score ?? p.score - pending, rank },
      participantCount: ranking.length,
      question:
        q && s.phase === 'QUESTION_OPEN'
          ? {
              view: toParticipantQuestionView(q), // LEAK BOUNDARY
              openedAt: s.questionOpenedAt ?? now(),
              closesAt: s.questionClosesAt,
              alreadyAnswered: !!answer,
              yourAnswer: answer?.payload ?? null,
            }
          : null,
      roundResult: q && s.phase === 'QUESTION_CLOSED' ? this.cachedRoundResult(s).forParticipant(p) : null,
      final:
        s.phase === 'FINAL_RANKING'
          ? participantFinal((await this.finalRanking(s)).finalView, ranking, p)
          : null,
      serverTime: now(),
    };
  }

  private participantNs() {
    return this.io.of('/participant');
  }
  private presenterNs() {
    return this.io.of('/presenter');
  }
}

function toStatsParticipant(p: ParticipantState) {
  return {
    participantId: p.id,
    nickname: p.nickname,
    score: p.score,
    isKicked: p.isKicked,
    joinedAt: p.joinedAt,
  };
}

function toParticipantInfo(p: ParticipantState) {
  return {
    id: p.id,
    nickname: p.nickname,
    connected: p.connected,
    score: p.score,
    isKicked: p.isKicked,
    joinedAt: p.joinedAt,
  };
}

function participantFinal(
  finalView: { podium: ReturnType<typeof podiumFrom> },
  ranking: Array<{ participantId: string; rank: number }>,
  p: ParticipantState,
) {
  return {
    yourRank: ranking.find((r) => r.participantId === p.id)?.rank ?? 0,
    yourScore: p.score,
    podium: finalView.podium,
    participantCount: ranking.length,
  };
}

function toRankingEntry(r: { participantId: string; nickname: string; score: number; rank: number }) {
  return { participantId: r.participantId, nickname: r.nickname, score: r.score, rank: r.rank };
}

export function presenterRoom(sessionId: string): string {
  return `session:${sessionId}:presenter`;
}
function participantsRoom(sessionId: string): string {
  return `session:${sessionId}:participants`;
}

function* pAnswers(s: LiveSessionState): Generator<{
  participantId: string;
  questionIndex: number;
  payload: AnswerPayload;
  isCorrect: boolean | null;
  pointsAwarded: number;
  elapsedMs: number;
}> {
  // Kicked participants are out of the ranking and of the final stats alike: their answers
  // must not make one of them the session's `fastestCorrect`.
  for (const p of s.participants.values()) {
    if (p.isKicked) continue;
    for (const [index, a] of p.answers) {
      yield {
        participantId: p.id,
        questionIndex: index,
        payload: a.payload,
        isCorrect: a.isCorrect,
        pointsAwarded: a.pointsAwarded,
        elapsedMs: a.elapsedMs,
      };
    }
  }
}
