// Mock live server — replays the §6 protocol in memory from the fixtures,
// using the REAL state machine and REAL scoring. No database.
// Run: pnpm mock:live  (from packages/shared, or pnpm mock:live at root)
//
// Lot 1 (UX) additions, all dev-only and confined to this file (see docs/UX_REDESIGN_PLAN.md § 11):
//   GET  /api/v1/join/:code            — JoinInfoDTO / 404 / 410, so the participant page runs on the mock alone
//   GET  /mock/sessions                — list sessions (id, code, phase…) — the way a pilot finds a sessionId
//   POST /mock/sessions                — create a session { quiz?: 'demo' | 'showcase', ackDelayMs?: number }
//   GET  /mock/sessions/:id            — session detail including the quiz snapshot (correct answers — mock only)
//   POST /mock/sessions/:id/ack-delay  — { ms } delay answer acks (captures the "sélection en cours" state)
//   POST /mock/sessions/:id/disconnect — transport cut of every participant socket (reconnection banner)
//   GET  /uploads/mock-sample.svg      — image used by the showcase fixture
//   presenter command `participant:kick` and event `session:final` (both were missing);
//   `question:open` / `question:closed` are now sent once per socket (the per-participant result was
//   broadcast to the whole room, so the last participant's result overwrote everyone's).
//
// Lot 2 (UX, stage) additions — the presenter side of the protocol was incomplete:
//   `question:closed` { audience: 'presenter', result } is now emitted (distribution, answers, fastest,
//   top 5, previousRanks — same shape as SessionManager, built with the shared stats helpers) and the
//   presenter snapshot carries `roundResult` while the phase is QUESTION_CLOSED;
//   `session:final` stats come from `buildFinalStats` (best / worst / fastest were `null`);
//   POST /mock/sessions { pointsScale } — multiplies every question's points (five-digit scores on the podium)
//   POST /mock/sessions/:id/settings   — partial LiveSessionSettings, emits `settings:changed`
//   POST /mock/sessions/:id/disconnect — accepts { namespace: 'participant' | 'presenter' } (default participant)
//   POST /mock/sessions/:id/replace    — `participant:replaced` then a namespace disconnect to every participant
//                                        socket, as the API does when another tab resumes the same token (the
//                                        mock has no token resume of its own)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import { Server as SocketIOServer, type Socket } from 'socket.io';

import {
  answeredInOrder,
  buildFinalStats,
  buildQuestionDistribution,
  buildRanking,
  buildVisibleRanking,
  canTransition,
  correctAnswerFor,
  errorMessage,
  GRACE_MS,
  INTERMEDIATE_RANKING_SIZE,
  isJoinable,
  nextPhase,
  parseNumericInput,
  parseTextInput,
  podiumFrom,
  scoreAnswer,
  SESSION_CODE_ALPHABET,
  SESSION_CODE_LENGTH,
  SettingsUpdateCommand,
  toParticipantQuestionView,
  validateNickname,
  type AnswerPayload,
  type LiveSessionSettings,
  type ParticipantQuestionView,
  type QuizSnapshot,
  type RankingRow,
  type SessionPhase,
  type SnapshotQuestion,
} from '../src/index.js';
import { FIXTURE_QUIZ_SHOWCASE, FIXTURE_QUIZ_SNAPSHOT } from '../test/fixtures.js';

const PORT = Number(process.env.MOCK_PORT ?? 4001);
// Loopback by default: the mock accepts any presenter without authentication, so it must not be
// reachable from the LAN unless someone opts in explicitly (MOCK_HOST=0.0.0.0).
const HOST = process.env.MOCK_HOST ?? '127.0.0.1';
const PUBLIC_URL = process.env.MOCK_PUBLIC_URL ?? 'http://localhost:5173';

type FixtureKind = 'demo' | 'showcase';

interface MockAnswer {
  payload: AnswerPayload;
  pointsBase: number;
  pointsBonus: number;
  pointsAwarded: number;
  elapsedMs: number;
  isCorrect: boolean | null;
}

interface MockParticipant {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  isKicked: boolean;
  joinedAt: number;
  answers: Map<number, MockAnswer>;
}

interface MockSession {
  id: string;
  code: string;
  quizSnapshot: QuizSnapshot;
  phase: SessionPhase;
  currentQuestionIndex: number;
  questionOpenedAt: number | null;
  questionClosesAt: number | null;
  startedAt: number | null;
  settings: LiveSessionSettings;
  participants: Map<string, MockParticipant>;
  timer: NodeJS.Timeout | null;
  /** Lot 1: artificial delay before an answer ack (ms). */
  ackDelayMs: number;
  /** Lot 2: per-question aggregates (feed buildFinalStats) and the last presenter result view. */
  results: Map<number, { participantsAtClose: number; answersCount: number; correctCount: number }>;
  lastResult: Record<string, unknown> | null;
}

const sessions = new Map<string, MockSession>();
const codeToSession = new Map<string, MockSession>();

function randomCode(): string {
  let code = '';
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += SESSION_CODE_ALPHABET[Math.floor(Math.random() * SESSION_CODE_ALPHABET.length)];
  }
  return code;
}

function loadFixtureQuiz(kind: FixtureKind): QuizSnapshot {
  return structuredClone(kind === 'showcase' ? FIXTURE_QUIZ_SHOWCASE : FIXTURE_QUIZ_SNAPSHOT);
}

function createSession(kind: FixtureKind = 'demo', ackDelayMs = 0, pointsScale = 1): MockSession {
  const quiz = loadFixtureQuiz(kind);
  if (pointsScale !== 1) {
    // Lot 2: scaled points — the showcase quiz tops out around 600 points, the stage must also be
    // checked with five-digit scores (plan § 11.4 crit. 8).
    for (const q of quiz.questions) {
      q.pointsCorrect = Math.round(q.pointsCorrect * pointsScale);
      q.pointsWrong = Math.round(q.pointsWrong * pointsScale);
      q.speedBonusMax = Math.round(q.speedBonusMax * pointsScale);
    }
  }
  const session: MockSession = {
    id: randomUUID(),
    code: randomCode(),
    quizSnapshot: quiz,
    phase: 'LOBBY',
    currentQuestionIndex: -1,
    questionOpenedAt: null,
    questionClosesAt: null,
    startedAt: null,
    settings: { showIntermediateRanking: true, showParticipantAnswers: false },
    participants: new Map(),
    timer: null,
    ackDelayMs,
    results: new Map(),
    lastResult: null,
  };
  sessions.set(session.id, session);
  codeToSession.set(session.code, session);
  return session;
}

const now = () => Date.now();

function presenterRoom(id: string): string {
  return `session:${id}:presenter`;
}
function participantsRoom(id: string): string {
  return `session:${id}:participants`;
}

function currentQuestion(s: MockSession): SnapshotQuestion | null {
  if (s.currentQuestionIndex < 0) return null;
  return s.quizSnapshot.questions[s.currentQuestionIndex] ?? null;
}

function aliveParticipants(s: MockSession): MockParticipant[] {
  return [...s.participants.values()].filter((p) => !p.isKicked);
}

/** The API's ranking, not a local one: score, time of the correct answers, arrival; dense ties. */
function rankingOf(s: MockSession): RankingRow[] {
  return buildRanking(statsParticipants(s), statsAnswers(s));
}

const toRankingEntry = ({ participantId, nickname, score, rank }: RankingRow) => ({
  participantId,
  nickname,
  score,
  rank,
});

function participantRank(ranking: RankingRow[], participantId: string): number {
  return ranking.find((r) => r.participantId === participantId)?.rank ?? ranking.length;
}

/** Every live socket of a participant (a participant may reconnect from several tabs). */
function socketsOf(participantId: string): Socket[] {
  return [...participantNs.sockets.values()].filter((sock) => sock.data.participantId === participantId);
}

/** One pass over the participant sockets, for per-participant fan-outs. */
function socketsByParticipant(): Map<string, Socket[]> {
  const byId = new Map<string, Socket[]>();
  for (const sock of participantNs.sockets.values()) {
    const id = sock.data.participantId as string | undefined;
    if (!id) continue;
    const list = byId.get(id);
    if (list) list.push(sock);
    else byId.set(id, [sock]);
  }
  return byId;
}

// --- Snapshot builders ------------------------------------------------------

function buildParticipantSnapshot(s: MockSession, p: MockParticipant) {
  const q = currentQuestion(s);
  const ranking = rankingOf(s);
  // Like the API: while a question is open, its points stay out of the participant's score and rank.
  const openIndex = s.phase === 'QUESTION_OPEN' ? s.currentQuestionIndex : null;
  const visible = buildVisibleRanking(statsParticipants(s), statsAnswers(s), openIndex);
  const you = visible.find((r) => r.participantId === p.id);
  const view: ParticipantQuestionView | null = q ? toParticipantQuestionView(q) : null;
  const answer = q ? p.answers.get(s.currentQuestionIndex) : undefined;
  return {
    sessionId: s.id,
    code: s.code,
    quizTitle: s.quizSnapshot.title,
    phase: s.phase,
    questionIndex: s.currentQuestionIndex,
    totalQuestions: s.quizSnapshot.questions.length,
    you: {
      participantId: p.id,
      nickname: p.nickname,
      score: you?.score ?? 0,
      rank: participantRank(visible, p.id),
    },
    participantCount: ranking.length,
    question:
      view && s.phase === 'QUESTION_OPEN'
        ? {
            view,
            openedAt: s.questionOpenedAt ?? now(),
            closesAt: s.questionClosesAt,
            alreadyAnswered: !!answer,
            yourAnswer: answer?.payload ?? null,
          }
        : null,
    roundResult: null,
    final: s.phase === 'FINAL_RANKING' ? buildParticipantFinal(ranking, p) : null,
    serverTime: now(),
  };
}

function participantInfo(p: MockParticipant) {
  return {
    id: p.id,
    nickname: p.nickname,
    connected: p.connected,
    score: p.score,
    isKicked: p.isKicked,
    joinedAt: p.joinedAt,
  };
}

function buildPresenterSnapshot(s: MockSession) {
  const q = currentQuestion(s);
  const alive = aliveParticipants(s);
  return {
    sessionId: s.id,
    code: s.code,
    joinUrl: `${PUBLIC_URL}/j/${s.code}`,
    quizTitle: s.quizSnapshot.title,
    phase: s.phase,
    questionIndex: s.currentQuestionIndex,
    totalQuestions: s.quizSnapshot.questions.length,
    settings: s.settings,
    participants: alive.map(participantInfo),
    question:
      q && s.phase === 'QUESTION_OPEN'
        ? {
            view: q,
            openedAt: s.questionOpenedAt ?? now(),
            closesAt: s.questionClosesAt,
            answered: alive.filter((p) => p.answers.has(s.currentQuestionIndex)).length,
            answeredIds: answeredIdsOf(s, s.currentQuestionIndex),
            connected: alive.filter((p) => p.connected).length,
          }
        : null,
    roundResult: s.phase === 'QUESTION_CLOSED' ? s.lastResult : null,
    final: s.phase === 'FINAL_RANKING' ? buildPresenterFinal(s) : null,
    serverTime: now(),
  };
}

// --- Final ranking (lot 1: the mock never emitted session:final) -------------

function buildParticipantFinal(ranking: RankingRow[], p: MockParticipant) {
  return {
    yourRank: participantRank(ranking, p.id),
    yourScore: p.score,
    podium: podiumFrom(ranking),
    participantCount: ranking.length,
  };
}

// Lot 2: participants / answers in the shape the shared stats helpers expect.
function statsParticipants(s: MockSession) {
  return [...s.participants.values()].map((p) => ({
    participantId: p.id,
    nickname: p.nickname,
    score: p.score,
    isKicked: p.isKicked,
    joinedAt: p.joinedAt,
  }));
}

function statsAnswers(s: MockSession) {
  return aliveParticipants(s).flatMap((p) =>
    [...p.answers.entries()].map(([questionIndex, a]) => ({
      participantId: p.id,
      questionIndex,
      payload: a.payload,
      isCorrect: a.isCorrect,
      pointsAwarded: a.pointsAwarded,
      elapsedMs: a.elapsedMs,
    })),
  );
}

function buildPresenterFinal(s: MockSession) {
  const ranking = rankingOf(s);
  return {
    podium: podiumFrom(ranking),
    ranking: ranking.map(toRankingEntry),
    stats: buildFinalStats(
      s.quizSnapshot.questions,
      [...s.results.entries()].map(([questionIndex, r]) => ({ questionIndex, ...r })),
      statsAnswers(s),
      statsParticipants(s),
    ),
  };
}

// --- Broadcast helpers -------------------------------------------------------

function emitParticipantsList(s: MockSession) {
  const alive = aliveParticipants(s);
  presenterNs
    .to(presenterRoom(s.id))
    .emit('participants:list', { participants: alive.map(participantInfo), count: alive.length });
}

function emitLobbyCount(s: MockSession) {
  participantNs.to(participantsRoom(s.id)).emit('lobby:count', { count: aliveParticipants(s).length });
}

function emitPhase(s: MockSession) {
  const payload = { phase: s.phase, questionIndex: s.currentQuestionIndex, serverTime: now() };
  presenterNs.to(presenterRoom(s.id)).emit('session:phase', payload);
  participantNs.to(participantsRoom(s.id)).emit('session:phase', payload);
}

function emitFinal(s: MockSession) {
  presenterNs
    .to(presenterRoom(s.id))
    .emit('session:final', { audience: 'presenter', final: buildPresenterFinal(s) });
  const ranking = rankingOf(s);
  const sockets = socketsByParticipant();
  for (const p of aliveParticipants(s)) {
    const final = buildParticipantFinal(ranking, p);
    for (const sock of sockets.get(p.id) ?? [])
      sock.emit('session:final', { audience: 'participant', final });
  }
}

// --- Question lifecycle ------------------------------------------------------

function openQuestion(s: MockSession) {
  s.currentQuestionIndex += 1;
  s.phase = 'QUESTION_OPEN';
  s.lastResult = null;
  s.questionOpenedAt = now();
  const q = currentQuestion(s)!;
  s.questionClosesAt = q.timeLimitSec ? now() + q.timeLimitSec * 1000 : null;

  if (s.questionClosesAt) {
    s.timer = setTimeout(() => closeQuestion(s), q.timeLimitSec! * 1000 + GRACE_MS);
  }

  const base = {
    questionIndex: s.currentQuestionIndex,
    totalQuestions: s.quizSnapshot.questions.length,
    openedAt: s.questionOpenedAt,
    closesAt: s.questionClosesAt,
    serverTime: now(),
  };
  presenterNs.to(presenterRoom(s.id)).emit('question:open', { view: q, ...base });
  participantNs
    .to(participantsRoom(s.id))
    .emit('question:open', { view: toParticipantQuestionView(q), ...base });
  emitPhase(s);
}

function closeQuestion(s: MockSession) {
  if (s.phase !== 'QUESTION_OPEN') return;
  if (s.timer) {
    clearTimeout(s.timer);
    s.timer = null;
  }
  const q = currentQuestion(s)!;
  s.phase = 'QUESTION_CLOSED';
  const index = s.currentQuestionIndex;

  // Lot 2 — presenter result view, same shape as SessionManager.closeQuestion.
  const alive = aliveParticipants(s);
  const answerRows = alive.filter((p) => p.answers.has(index)).map((p) => ({ p, a: p.answers.get(index)! }));
  const correctRows = answerRows.filter(({ a }) => a.isCorrect === true);
  const correctCount = correctRows.length;
  const correctAnswer = correctAnswerFor(q);
  const distribution = buildQuestionDistribution(
    q,
    answerRows.map(({ a }) => a),
    correctCount,
  );
  const textEntries = distribution.kind === 'TEXT' ? distribution.entries : null;
  const fastest = correctRows.sort((x, y) => x.a.elapsedMs - y.a.elapsedMs)[0];
  const ranking = rankingOf(s);
  s.results.set(index, { participantsAtClose: alive.length, answersCount: answerRows.length, correctCount });
  s.lastResult = {
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
    fastestCorrect: fastest
      ? { participantId: fastest.p.id, nickname: fastest.p.nickname, elapsedMs: fastest.a.elapsedMs }
      : null,
    top5: ranking.slice(0, INTERMEDIATE_RANKING_SIZE).map(toRankingEntry),
    previousRanks: Object.fromEntries(ranking.map((r) => [r.participantId, r.rank])),
    explanation: q.explanation,
  };
  presenterNs
    .to(presenterRoom(s.id))
    .emit('question:closed', { audience: 'presenter', result: s.lastResult });

  // Individualised participant results — one payload per participant, sent only to their sockets.
  const sockets = socketsByParticipant();
  for (const p of alive) {
    const a = p.answers.get(index);
    const result = {
      questionIndex: index,
      correctAnswer,
      yourAnswer: a?.payload ?? null,
      isCorrect: a?.isCorrect ?? null,
      pointsBase: a?.pointsBase ?? 0,
      pointsBonus: a?.pointsBonus ?? 0,
      pointsAwarded: a?.pointsAwarded ?? 0,
      totalScore: p.score,
      rank: participantRank(ranking, p.id),
      participantCount: ranking.length,
      textEntries,
      explanation: q.explanation,
    };
    for (const sock of sockets.get(p.id) ?? [])
      sock.emit('question:closed', { audience: 'participant', result });
  }
  // Scores changed with this round: refresh the presenter's participants panel.
  emitParticipantsList(s);
  emitPhase(s);
}

function answeredIdsOf(s: MockSession, index: number): string[] {
  return answeredInOrder(
    aliveParticipants(s).map((p) => ({ id: p.id, elapsedMs: p.answers.get(index)?.elapsedMs })),
  );
}

/** Drops every answer to question `index` and its result, rolling the scores back. */
function discardAnswers(s: MockSession, index: number) {
  for (const p of s.participants.values()) {
    const a = p.answers.get(index);
    if (!a) continue;
    p.score -= a.pointsAwarded;
    p.answers.delete(index);
  }
  s.results.delete(index);
}

// --- HTTP (health, join info, mock control) ------------------------------------

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <rect width="640" height="360" fill="#e2e5e9"/>
  <g fill="#9aa1aa">
    <rect x="72" y="72" width="120" height="216" rx="8"/>
    <rect x="216" y="128" width="120" height="160" rx="8"/>
    <rect x="360" y="40" width="120" height="248" rx="8"/>
    <rect x="504" y="176" width="64" height="112" rx="8"/>
  </g>
  <text x="320" y="330" font-family="sans-serif" font-size="20" fill="#535a63" text-anchor="middle">Aperçu — image de démonstration</text>
</svg>`;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString('utf8')));
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sessionSummary(s: MockSession) {
  return {
    id: s.id,
    code: s.code,
    phase: s.phase,
    quizTitle: s.quizSnapshot.title,
    questionIndex: s.currentQuestionIndex,
    totalQuestions: s.quizSnapshot.questions.length,
    participantCount: aliveParticipants(s).length,
  };
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';
  const path = url.pathname;

  if (path === '/healthz') return json(res, 200, { ok: true });

  if (path === '/uploads/mock-sample.svg') {
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
    res.end(SAMPLE_SVG);
    return;
  }

  // Public join info (§ REST /join/:code) — same shape and status codes as the API.
  const join = /^\/api\/v1\/join\/([A-Za-z0-9]+)$/.exec(path);
  if (join && method === 'GET') {
    const s = codeToSession.get(join[1]!.toUpperCase());
    if (!s)
      return json(res, 404, { error: { code: 'SESSION_NOT_FOUND', message: 'Aucune session avec ce code' } });
    if (!isJoinable(s.phase))
      return json(res, 410, {
        error: { code: 'SESSION_CLOSED_TO_JOIN', message: 'La session est terminée' },
      });
    return json(res, 200, {
      sessionId: s.id,
      quizTitle: s.quizSnapshot.title,
      phase: s.phase,
      participantCount: aliveParticipants(s).length,
    });
  }

  if (path === '/mock/sessions' && method === 'GET') {
    return json(res, 200, { sessions: [...sessions.values()].map(sessionSummary) });
  }
  if (path === '/mock/sessions' && method === 'POST') {
    const body = await readJson(req);
    const kind: FixtureKind = body.quiz === 'showcase' ? 'showcase' : 'demo';
    const ackDelayMs = typeof body.ackDelayMs === 'number' ? body.ackDelayMs : 0;
    const pointsScale = typeof body.pointsScale === 'number' && body.pointsScale > 0 ? body.pointsScale : 1;
    const s = createSession(kind, ackDelayMs, pointsScale);
    console.log(`[mock] session ${s.code} (${s.quizSnapshot.title}) created — id ${s.id}`);
    return json(res, 201, sessionSummary(s));
  }

  const one = /^\/mock\/sessions\/([0-9a-f-]+)(?:\/([a-z-]+))?$/.exec(path);
  if (one) {
    const s = sessions.get(one[1]!);
    if (!s) return json(res, 404, { error: { code: 'SESSION_NOT_FOUND', message: 'Session inconnue' } });
    const action = one[2];
    if (!action && method === 'GET') {
      return json(res, 200, {
        ...sessionSummary(s),
        participants: aliveParticipants(s).map(participantInfo),
        quiz: s.quizSnapshot,
      });
    }
    if (action === 'ack-delay' && method === 'POST') {
      const body = await readJson(req);
      s.ackDelayMs = typeof body.ms === 'number' ? Math.max(0, body.ms) : 0;
      return json(res, 200, { ok: true, ackDelayMs: s.ackDelayMs });
    }
    if (action === 'disconnect' && method === 'POST') {
      const body = await readJson(req);
      // Lot 2: { namespace: 'presenter' } cuts the stage sockets instead (reconnection banner on stage).
      const ns = body.namespace === 'presenter' ? presenterNs : participantNs;
      // A participant cut is a transport close, as a network drop: a namespace disconnect is what
      // the API sends a replaced tab, and the phone would show its terminal screen instead of the
      // reconnection banner. Handshakes are refused RATE_LIMITED for a moment, so the banner stays
      // up long enough to be captured before the phone's paced retry gets back in.
      if (ns === participantNs) participantHoldUntil = Date.now() + 3000;
      let n = 0;
      for (const sock of ns.sockets.values()) {
        if (sock.data.sessionId === s.id) {
          if (ns === participantNs) sock.conn.close();
          else sock.disconnect(true);
          n += 1;
        }
      }
      return json(res, 200, { ok: true, disconnected: n });
    }
    if (action === 'replace' && method === 'POST') {
      let n = 0;
      for (const sock of participantNs.sockets.values()) {
        if (sock.data.sessionId === s.id) {
          sock.emit('participant:replaced');
          // Namespace disconnect, as SessionManager: the client does not reconnect on its own.
          sock.disconnect();
          n += 1;
        }
      }
      return json(res, 200, { ok: true, replaced: n });
    }
    // Lot 2: live settings toggle from the e2e driver (a REST twin of the presenter command
    // `settings:update`) — needed to capture the closed screen with and without the top 5.
    if (action === 'settings' && method === 'POST') {
      const body = await readJson(req);
      if (typeof body.showIntermediateRanking === 'boolean') {
        s.settings.showIntermediateRanking = body.showIntermediateRanking;
      }
      if (typeof body.showParticipantAnswers === 'boolean') {
        s.settings.showParticipantAnswers = body.showParticipantAnswers;
      }
      presenterNs.to(presenterRoom(s.id)).emit('settings:changed', s.settings);
      return json(res, 200, { ok: true, settings: s.settings });
    }
  }

  res.writeHead(404);
  res.end();
}

// --- Boot --------------------------------------------------------------------

const httpServer = createServer((req, res) => {
  void handleHttp(req, res);
});

const io = new SocketIOServer(httpServer, {
  path: '/socket.io',
  maxHttpBufferSize: 8 * 1024,
  pingInterval: 10000,
  pingTimeout: 20000,
});

const participantNs = io.of('/participant');
const presenterNs = io.of('/presenter');

/** Until then, /participant handshakes are refused RATE_LIMITED: see the `disconnect` route. */
let participantHoldUntil = 0;
participantNs.use((_socket, next) => {
  if (Date.now() < participantHoldUntil) {
    return next(Object.assign(new Error(errorMessage('RATE_LIMITED')), { data: { code: 'RATE_LIMITED' } }));
  }
  next();
});

// Auto-create one session on boot so lots 5/6 can develop immediately.
const bootSession = createSession();
console.log(
  `[mock] session ${bootSession.code} (${bootSession.quizSnapshot.title}) — join with code ${bootSession.code} — id ${bootSession.id}`,
);

participantNs.on('connection', (socket: Socket) => {
  socket.on('participant:join', (raw: unknown, ack?: (r: unknown) => void) => {
    const fail = (code: string, message: string) => ack?.({ ok: false, code, message });
    if (typeof raw !== 'object' || raw === null) return fail('VALIDATION', 'Payload invalide');
    const { code, nickname } = raw as { code?: string; nickname?: string };
    const session = codeToSession.get(String(code ?? '').toUpperCase());
    if (!session) return fail('SESSION_NOT_FOUND', 'Aucune session avec ce code');
    if (!isJoinable(session.phase)) return fail('SESSION_CLOSED_TO_JOIN', 'La session est terminée');

    const validation = validateNickname(String(nickname ?? ''));
    if (!validation.ok) return fail(validation.code, validation.message);

    const taken = new Set([...session.participants.values()].map((p) => p.nickname.toLowerCase()));
    if (taken.has(validation.key)) return fail('NICKNAME_TAKEN', 'Ce pseudo est déjà pris');

    const token = randomUUID();
    const participant: MockParticipant = {
      id: randomUUID(),
      nickname: validation.nickname,
      score: 0,
      connected: true,
      isKicked: false,
      joinedAt: now(),
      answers: new Map(),
    };
    session.participants.set(participant.id, participant);
    socket.join(participantsRoom(session.id));
    socket.data.sessionId = session.id;
    socket.data.participantId = participant.id;

    ack?.({ ok: true, participantId: participant.id, token });
    socket.emit('state:snapshot', buildParticipantSnapshot(session, participant));
    emitParticipantsList(session);
    if (session.phase === 'LOBBY') emitLobbyCount(session);
  });

  socket.on('answer:submit', (raw: unknown, ack?: (r: unknown) => void) => {
    const fail = (code: string, message: string) => ack?.({ ok: false, code, message });
    const session = sessions.get(socket.data.sessionId as string);
    const participant = session?.participants.get(socket.data.participantId as string);
    if (!session || !participant) return fail('TOKEN_INVALID', 'Session expirée');
    if (session.phase !== 'QUESTION_OPEN') return fail('QUESTION_CLOSED', 'La question est terminée');

    const { questionIndex, answer } = (raw ?? {}) as {
      questionIndex?: number;
      answer?: { choiceId?: string; value?: string; text?: string };
    };
    if (questionIndex !== session.currentQuestionIndex) return fail('WRONG_QUESTION', 'Question obsolète');
    if (participant.answers.has(questionIndex)) return fail('ALREADY_ANSWERED', 'Déjà répondu');

    const q = currentQuestion(session)!;
    let payload: AnswerPayload;
    if (q.type === 'NUMERIC') {
      const parsed = parseNumericInput(String(answer?.value ?? ''));
      if (!parsed.ok) return fail('INVALID_NUMBER', 'Nombre invalide');
      payload = { value: parsed.value };
    } else if (q.type === 'TEXT_POLL') {
      const parsed = parseTextInput(String(answer?.text ?? ''));
      if (!parsed.ok) return fail('INVALID_TEXT', parsed.message);
      payload = { text: parsed.text };
    } else {
      const choiceId = String(answer?.choiceId ?? '');
      if (!q.choices.some((c) => c.id === choiceId)) return fail('INVALID_CHOICE', 'Choix invalide');
      payload = { choiceId };
    }

    const elapsedMs = Math.max(0, now() - (session.questionOpenedAt ?? now()));
    const score = scoreAnswer(q, payload, elapsedMs);
    participant.score += score.pointsAwarded;
    participant.answers.set(questionIndex, {
      payload,
      pointsBase: score.pointsBase,
      pointsBonus: score.pointsBonus,
      pointsAwarded: score.pointsAwarded,
      elapsedMs,
      isCorrect: score.isCorrect,
    });
    const reply = () => ack?.({ ok: true, answeredAt: now() });
    if (session.ackDelayMs > 0) setTimeout(reply, session.ackDelayMs);
    else reply();
    // answers:progress is throttled out in the mock; emit directly (fine for dev).
    const alive = aliveParticipants(session);
    presenterNs.to(presenterRoom(session.id)).emit('answers:progress', {
      questionIndex,
      answered: alive.filter((p) => p.answers.has(questionIndex)).length,
      connected: alive.filter((p) => p.connected).length,
      total: alive.length,
      recent: [participant.nickname],
      answeredIds: answeredIdsOf(session, questionIndex),
    });
  });

  socket.on('disconnect', () => {
    const session = sessions.get(socket.data.sessionId as string);
    const participant = session?.participants.get(socket.data.participantId as string);
    if (session && participant) {
      participant.connected = false;
      emitParticipantsList(session);
    }
  });
});

presenterNs.on('connection', (socket: Socket) => {
  socket.on('session:start', (raw: unknown, ack?: (r: unknown) => void) => {
    const session = sessions.get(socket.data.sessionId as string);
    if (!session) return ack?.({ ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' });
    const ctx = {
      participantCount: aliveParticipants(session).length,
      currentQuestionIndex: session.currentQuestionIndex,
      lastIndex: session.quizSnapshot.questions.length - 1,
      force: !!(raw as { force?: boolean } | null)?.force,
    };
    if (!canTransition(session.phase, 'session:start', ctx))
      return ack?.({ ok: false, code: 'INVALID_PHASE', message: 'Phase invalide' });
    session.startedAt = now();
    session.phase = nextPhase(session.phase, 'session:start', ctx)!;
    openQuestion(session);
    ack?.({ ok: true });
  });

  socket.on('question:close', (raw: unknown, ack?: (r: unknown) => void) => {
    const session = sessions.get(socket.data.sessionId as string);
    if (!session) return ack?.({ ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' });
    const { expectedIndex } = (raw ?? {}) as { expectedIndex?: number };
    if (expectedIndex !== session.currentQuestionIndex)
      return ack?.({ ok: false, code: 'INDEX_MISMATCH', message: 'Index obsolète' });
    if (session.phase !== 'QUESTION_OPEN')
      return ack?.({ ok: false, code: 'INVALID_PHASE', message: 'Phase invalide' });
    closeQuestion(session);
    ack?.({ ok: true });
  });

  socket.on('question:next', (raw: unknown, ack?: (r: unknown) => void) => {
    const session = sessions.get(socket.data.sessionId as string);
    if (!session) return ack?.({ ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' });
    const { expectedIndex } = (raw ?? {}) as { expectedIndex?: number };
    if (expectedIndex !== session.currentQuestionIndex)
      return ack?.({ ok: false, code: 'INDEX_MISMATCH', message: 'Index obsolète' });
    const ctx = {
      participantCount: aliveParticipants(session).length,
      currentQuestionIndex: session.currentQuestionIndex,
      lastIndex: session.quizSnapshot.questions.length - 1,
    };
    if (!canTransition(session.phase, 'question:next', ctx))
      return ack?.({ ok: false, code: 'INVALID_PHASE', message: 'Phase invalide' });
    const next = nextPhase(session.phase, 'question:next', ctx)!;
    if (next === 'QUESTION_OPEN') openQuestion(session);
    else {
      session.phase = 'FINAL_RANKING';
      emitFinal(session);
      emitPhase(session);
    }
    ack?.({ ok: true });
  });

  // Step back from an open question to the previous result: that question's answers are dropped.
  socket.on('question:back', (raw: unknown, ack?: (r: unknown) => void) => {
    const session = sessions.get(socket.data.sessionId as string);
    if (!session) return ack?.({ ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' });
    const { expectedIndex } = (raw ?? {}) as { expectedIndex?: number };
    if (expectedIndex !== session.currentQuestionIndex)
      return ack?.({ ok: false, code: 'INDEX_MISMATCH', message: 'Index obsolète' });
    const ctx = {
      participantCount: aliveParticipants(session).length,
      currentQuestionIndex: session.currentQuestionIndex,
      lastIndex: session.quizSnapshot.questions.length - 1,
    };
    if (!canTransition(session.phase, 'question:back', ctx))
      return ack?.({ ok: false, code: 'INVALID_PHASE', message: 'Phase invalide' });
    if (session.timer) clearTimeout(session.timer);
    session.timer = null;
    discardAnswers(session, session.currentQuestionIndex);
    session.currentQuestionIndex -= 1;
    // closeQuestion rebuilds and re-sends the previous result from the remaining answers.
    session.phase = 'QUESTION_OPEN';
    closeQuestion(session);
    ack?.({ ok: true });
  });

  // Step back from a result to its question, reopened: its answers are dropped.
  socket.on('question:reopen', (raw: unknown, ack?: (r: unknown) => void) => {
    const session = sessions.get(socket.data.sessionId as string);
    if (!session) return ack?.({ ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' });
    const { expectedIndex } = (raw ?? {}) as { expectedIndex?: number };
    if (expectedIndex !== session.currentQuestionIndex)
      return ack?.({ ok: false, code: 'INDEX_MISMATCH', message: 'Index obsolète' });
    const ctx = {
      participantCount: aliveParticipants(session).length,
      currentQuestionIndex: session.currentQuestionIndex,
      lastIndex: session.quizSnapshot.questions.length - 1,
    };
    if (!canTransition(session.phase, 'question:reopen', ctx))
      return ack?.({ ok: false, code: 'INVALID_PHASE', message: 'Phase invalide' });
    discardAnswers(session, session.currentQuestionIndex);
    session.currentQuestionIndex -= 1; // openQuestion moves to the next index
    openQuestion(session);
    emitParticipantsList(session);
    ack?.({ ok: true });
  });

  // Lot 1: was missing — needed for the participant "retiré" state.
  socket.on('participant:kick', (raw: unknown, ack?: (r: unknown) => void) => {
    const session = sessions.get(socket.data.sessionId as string);
    if (!session) return ack?.({ ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' });
    const { participantId } = (raw ?? {}) as { participantId?: string };
    const participant = session.participants.get(String(participantId ?? ''));
    if (!participant || participant.isKicked)
      return ack?.({ ok: false, code: 'PARTICIPANT_NOT_FOUND', message: 'Participant inconnu' });
    participant.isKicked = true;
    participant.connected = false;
    for (const sock of socketsOf(participant.id)) {
      sock.emit('participant:kicked', { message: 'Vous avez été retiré de la session par le présentateur' });
      sock.leave(participantsRoom(session.id));
    }
    emitParticipantsList(session);
    if (session.phase === 'LOBBY') emitLobbyCount(session);
    ack?.({ ok: true });
  });

  // Same contract as the real API: partial patch, broadcast to every presenter view.
  socket.on('settings:update', (raw: unknown, ack?: (r: unknown) => void) => {
    const session = sessions.get(socket.data.sessionId as string);
    if (!session) return ack?.({ ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' });
    const parsed = SettingsUpdateCommand.safeParse(raw ?? {});
    if (!parsed.success) return ack?.({ ok: false, code: 'VALIDATION', message: 'Réglages invalides' });
    session.settings = { ...session.settings, ...parsed.data };
    presenterNs.to(presenterRoom(session.id)).emit('settings:changed', session.settings);
    ack?.({ ok: true, settings: session.settings });
  });

  socket.on('session:end', (_raw: unknown, ack?: (r: unknown) => void) => {
    const session = sessions.get(socket.data.sessionId as string);
    if (!session) return ack?.({ ok: false, code: 'SESSION_NOT_FOUND', message: 'Session inconnue' });
    session.phase = 'ENDED';
    const reason = session.startedAt ? 'ENDED' : 'CANCELLED';
    presenterNs.to(presenterRoom(session.id)).emit('session:ended', { reason });
    participantNs.to(participantsRoom(session.id)).emit('session:ended', { reason });
    // Like the API's shutdown: a namespace disconnect after the final event, no auto-reconnect.
    participantNs.in(participantsRoom(session.id)).disconnectSockets();
    ack?.({ ok: true });
  });

  // Presenter attach: auth.sessionId in the handshake.
  const auth = socket.handshake.auth as { sessionId?: string };
  if (auth?.sessionId && sessions.has(auth.sessionId)) {
    socket.data.sessionId = auth.sessionId;
    socket.join(presenterRoom(auth.sessionId));
    socket.emit('state:snapshot', buildPresenterSnapshot(sessions.get(auth.sessionId)!));
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[mock] live server on http://${HOST}:${PORT} (socket.io path /socket.io)`);
});
