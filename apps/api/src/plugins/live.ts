// Socket.IO plugin (§6.1): namespaces /presenter and /participant, auth middlewares,
// per-socket rate limits, ack-based commands wired to the SessionManager.

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer, type Socket } from 'socket.io';

import {
  AnswerSubmitCommand,
  JoinCommand,
  MAX_PARTICIPANT_SOCKETS_PER_IP,
  ParticipantKickCommand,
  ParticipantResumeAuth,
  PresenterAttachAuth,
  QuestionCloseCommand,
  QuestionBackCommand,
  QuestionNextCommand,
  QuestionReopenCommand,
  SessionStartCommand,
  SettingsUpdateCommand,
  errorMessage,
} from '@quiz/shared';

import { isDevOrTestEnv } from '../config.js';
import { ACCESS_TOKEN_COOKIE } from '../lib/api.js';
import { SessionManager, presenterRoom } from '../modules/live/SessionManager.js';
import {
  ConcurrencyCap,
  SocketLimiter,
  clientRateLimitKey,
  isAllowedOrigin,
} from '../modules/live/socket-guards.js';
import { allowedOrigins } from './csrf.js';

/** socket.io middleware refusal carrying a machine-readable code in `err.data`. */
function socketError(code: string, message: string): Error & { data: { code: string } } {
  return Object.assign(new Error(message), { data: { code } });
}

const answerLimiter = new SocketLimiter(5, 1000);
const joinLimiter = new SocketLimiter(5, 60_000);
const commandLimiter = new SocketLimiter(20, 1000);
// Per client IP: a room behind one NAT joins over a couple of minutes, a script filling the
// 500 seats from one machine does it in seconds. Bursts above these rates are refused
// RATE_LIMITED (the phone retries), so a bot is throttled, not the room.
const ipHandshakeLimiter = new SocketLimiter(120, 10_000);
const ipJoinLimiter = new SocketLimiter(60, 10_000);
// Open /participant sockets per client IP: the rates above slow a flood down, this bounds it.
const ipParticipantSockets = new ConcurrencyCap(MAX_PARTICIPANT_SOCKETS_PER_IP);

/**
 * Per-IP bucket key of a socket: the client IP as Caddy forwards it (clientIp, the same one-hop rule
 * as REST), an IPv6 client counted per /64 (the same rateLimitKey as REST).
 */
function socketIp(socket: Socket): string {
  return clientRateLimitKey(socket.handshake.headers, socket.handshake.address);
}

export const livePlugin = fp(
  async (app: FastifyInstance) => {
    const origins = allowedOrigins(app.config.PUBLIC_URL, !isDevOrTestEnv(app.config.NODE_ENV));
    const io = new SocketIOServer(app.server, {
      path: '/socket.io',
      maxHttpBufferSize: 8 * 1024,
      pingInterval: 10_000,
      pingTimeout: 20_000,
      transports: ['websocket', 'polling'],
      // Every handshake (both namespaces, both transports): a browser page from another origin must
      // not ride the admin's ambient cookie into /presenter. See isAllowedOrigin.
      allowRequest: (req, callback) => callback(null, isAllowedOrigin(req.headers.origin, origins)),
    });
    app.decorate('io', io);

    const manager = new SessionManager(io, app.prisma, () => app.config.PUBLIC_URL, app.log);
    app.decorate('sessionManager', manager);
    manager.loadAllOpen().catch((err: unknown) => app.log.error({ err }, 'boot-time session load failed'));

    // Graceful shutdown: disconnect everyone gently.
    app.addHook('onClose', async () => {
      manager.stop();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    });

    type Ack = (payload: unknown) => void;
    const getAck = (v: unknown): Ack | undefined => (typeof v === 'function' ? (v as Ack) : undefined);
    const ackErr = (v: unknown, code: string) =>
      getAck(v)?.({ ok: false, code, message: errorMessage(code) });
    const ackOk = (v: unknown, data: Record<string, unknown> = {}) => getAck(v)?.({ ok: true, ...data });

    /**
     * Async socket handlers run outside Fastify's error handling: a rejection there is an unhandled
     * promise, which ends the whole process — and every live session — on Node 22. Log and ack INTERNAL.
     */
    const guarded =
      (event: string, handler: (raw: unknown, ack?: unknown) => Promise<unknown>) =>
      (raw: unknown, ack?: unknown) => {
        handler(raw, ack).catch((err: unknown) => {
          app.log.error({ err, event }, 'socket handler failed');
          ackErr(ack, 'INTERNAL');
        });
      };

    // ---------------- default namespace ----------------
    // socket.io always serves `/`, and no client uses it: without this guard it would accept any
    // number of anonymous sockets per IP, outside the /participant caps. Every handshake is refused.
    io.of('/').use((_socket, next) => next(socketError('NOT_FOUND', errorMessage('NOT_FOUND'))));

    // ---------------- /participant namespace ----------------
    io.of('/participant').use(async (socket, next) => {
      const ip = socketIp(socket);
      if (!ipHandshakeLimiter.take(ip)) {
        return next(socketError('RATE_LIMITED', errorMessage('RATE_LIMITED')));
      }
      // RATE_LIMITED, not a code of its own: the phone keeps its token and retries after a pause.
      const releaseSlot = ipParticipantSockets.acquire(ip);
      if (!releaseSlot) return next(socketError('RATE_LIMITED', errorMessage('RATE_LIMITED')));
      // Freed (idempotently) on disconnect, on a refused handshake, or when the transport closes
      // before the namespace connection happens (socket.io then fires no `disconnect` at all).
      // The transport listener is removed on release: one engine.io connection can carry several
      // successive /participant sockets, and each would otherwise leave one behind.
      const release = () => {
        socket.conn.off('close', release);
        releaseSlot();
      };
      socket.once('disconnect', release);
      socket.conn.once('close', release);
      const refuse = (code: string, message = errorMessage(code)) => {
        release();
        next(socketError(code, message));
      };

      const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
      // No token (absent, null or empty): anonymous — will participant:join.
      if (auth.token === undefined || auth.token === null || auth.token === '') return next();
      const parsed = ParticipantResumeAuth.safeParse(auth);
      if (!parsed.success) return refuse('TOKEN_INVALID');
      let result: Awaited<ReturnType<typeof manager.resumeByToken>>;
      try {
        result = await manager.resumeByToken(socket, parsed.data.token);
      } catch (err) {
        app.log.error({ err }, 'participant resume failed');
        return refuse('INTERNAL');
      }
      if (!result.ok) return refuse(result.code, result.message);
      // The resume marked them online with this socket id. A transport closed while the snapshot
      // is built (or in the tick between `next()` and `connection`) makes socket.io drop the socket
      // without any `disconnect`: roll presence back from the transport itself. `markDisconnected`
      // is idempotent (socket id check), so the regular `disconnect` path may run it as well; the
      // listener goes on disconnect, as the slot release does, since one engine.io connection can
      // carry several successive /participant sockets.
      const { s: resumed, participant } = result;
      const dropPresence = () => {
        socket.conn.off('close', dropPresence);
        manager.markDisconnected(resumed, participant.id, socket.id);
      };
      socket.conn.once('close', dropPresence);
      socket.once('disconnect', () => socket.conn.off('close', dropPresence));
      try {
        socket.emit('state:snapshot', await manager.participantSnapshot(resumed, participant));
        next();
      } catch (err) {
        // A refused handshake fires no disconnect either: roll presence back, or the panel would
        // show them connected for good.
        app.log.error({ err }, 'participant snapshot failed');
        dropPresence();
        refuse('INTERNAL');
      }
    });

    io.of('/participant').on('connection', (socket: Socket) => {
      socket.on(
        'participant:join',
        guarded('participant:join', async (raw, ack) => {
          if (!joinLimiter.take(socket.id) || !ipJoinLimiter.take(socketIp(socket))) {
            return ackErr(ack, 'RATE_LIMITED');
          }
          // One participant per socket: a second join (double submit, or a resumed socket joining
          // again) would create another row and leave the first one flagged connected for good.
          // `participantId` is only set deep inside `manager.join`, after several awaits: the
          // `joining` flag closes that window for two joins emitted back to back.
          const data = socket.data as { participantId?: string; joining?: boolean };
          if (data.participantId || data.joining) return ackErr(ack, 'ALREADY_JOINED');
          const parsed = JoinCommand.safeParse(raw);
          if (!parsed.success) return ackErr(ack, 'NICKNAME_INVALID');
          data.joining = true;
          let result: Awaited<ReturnType<typeof manager.join>>;
          try {
            result = await manager.join(socket, parsed.data.code, parsed.data.nickname);
          } finally {
            data.joining = false;
          }
          if (!result.ok) return ackErr(ack, result.code);
          ackOk(ack, { participantId: result.participant.id, token: result.token });
          socket.emit('state:snapshot', await manager.participantSnapshot(result.s, result.participant));
        }),
      );

      socket.on(
        'answer:submit',
        guarded('answer:submit', async (raw, ack) => {
          if (!answerLimiter.take(socket.id)) return ackErr(ack, 'RATE_LIMITED');
          const sessionId = (socket.data as { sessionId?: string }).sessionId;
          const participantId = (socket.data as { participantId?: string }).participantId;
          if (!sessionId || !participantId) return ackErr(ack, 'TOKEN_INVALID');
          const parsed = AnswerSubmitCommand.safeParse(raw);
          if (!parsed.success) return ackErr(ack, 'INVALID_CHOICE');
          const s = await manager.getOrLoad(sessionId);
          const p = s?.participants.get(participantId);
          if (!s || !p) return ackErr(ack, 'TOKEN_INVALID');
          const result = await manager.submitAnswer(
            s,
            p,
            parsed.data.questionIndex,
            parsed.data.answer as { choiceId?: string; value?: string; text?: string },
          );
          if (!result.ok) return ackErr(ack, result.code);
          ackOk(ack, { answeredAt: result.answeredAt });
        }),
      );

      socket.on('disconnect', () => {
        joinLimiter.release(socket.id);
        answerLimiter.release(socket.id);
        const sessionId = (socket.data as { sessionId?: string }).sessionId;
        const participantId = (socket.data as { participantId?: string }).participantId;
        if (!sessionId || !participantId) return;
        manager
          .getOrLoad(sessionId)
          .then((s) => {
            // socket.id: a socket replaced by a resume must not mark the new connection offline.
            if (s) manager.markDisconnected(s, participantId, socket.id);
          })
          .catch((err: unknown) => app.log.error({ err }, 'disconnect bookkeeping failed'));
      });

      // Last, once `disconnect` is wired: a resume ended, kicked or replaced during its handshake.
      manager.settleResumed(socket);
    });

    // ---------------- /presenter namespace ----------------
    io.of('/presenter').use(async (socket, next) => {
      const cookiePrefix = `${ACCESS_TOKEN_COOKIE}=`;
      const token = (socket.handshake.headers.cookie ?? '')
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith(cookiePrefix));
      // The access cookie lives as long as the JWT, so an expired session usually shows up as a
      // missing cookie rather than a bad token: the client refreshes on both codes.
      if (!token) return next(socketError('UNAUTHORIZED', 'Non authentifié'));
      const attach = PresenterAttachAuth.safeParse(socket.handshake.auth ?? {});
      if (!attach.success) return next(socketError('SESSION_NOT_FOUND', 'Session inconnue'));
      const { sessionId } = attach.data;
      try {
        // Same check as the REST guard: signature/alg/iss/aud/exp, logout, inactive account and
        // credential version (a password change refuses every earlier token).
        const check = await app.verifyAccessToken(token.slice(cookiePrefix.length));
        if (!check.ok) {
          return next(
            check.reason === 'invalid'
              ? socketError('TOKEN_EXPIRED', 'Session expirée, reconnexion…')
              : socketError('UNAUTHORIZED', 'Non authentifié'),
          );
        }
        const { adminId } = check;
        (socket.data as { adminId: string }).adminId = adminId;
        // Ownership from the row first: a non-owner must not be able to pull a session into memory.
        const row = await app.prisma.liveSession.findUnique({
          where: { id: sessionId },
          select: { presenterId: true },
        });
        if (!row) return next(socketError('SESSION_NOT_FOUND', 'Session inconnue'));
        if (row.presenterId !== adminId) {
          return next(socketError('FORBIDDEN', 'Vous n’êtes pas le présentateur'));
        }
        // presenterId is never updated, so the in-memory copy getOrLoad returns is the row's value.
        const s = await manager.getOrLoad(sessionId);
        if (!s) return next(socketError('SESSION_NOT_FOUND', 'Session inconnue'));
        socket.join(presenterRoom(sessionId));
        (socket.data as { sessionId?: string }).sessionId = sessionId;
        socket.emit('state:snapshot', await manager.presenterSnapshot(s));
        next();
      } catch (err) {
        app.log.error({ err }, 'presenter handshake failed');
        next(socketError('INTERNAL', errorMessage('INTERNAL')));
      }
    });

    io.of('/presenter').on('connection', (socket: Socket) => {
      const getSession = () => manager.getOrLoad((socket.data as { sessionId?: string }).sessionId ?? '');
      socket.on('disconnect', () => commandLimiter.release(socket.id));

      /** A presenter command: rate-limited per socket (§6.7) before anything else runs. */
      const command = (event: string, handler: (raw: unknown, ack?: unknown) => Promise<unknown>) =>
        socket.on(
          event,
          guarded(event, async (raw, ack) => {
            if (!commandLimiter.take(socket.id)) return ackErr(ack, 'RATE_LIMITED');
            return handler(raw, ack);
          }),
        );

      command('session:start', async (raw, ack) => {
        const parsed = SessionStartCommand.safeParse(raw ?? {});
        const s = await getSession();
        if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
        const result = await manager.startSession(s, parsed.success ? !!parsed.data.force : false);
        if (!result.ok) return ackErr(ack, result.code);
        ackOk(ack);
      });

      // The four commands that carry `expectedIndex` (idempotence, §6.5) differ only by their schema
      // and the manager method they reach.
      type LiveSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
      const indexCommands = [
        [
          'question:close',
          QuestionCloseCommand,
          (s: LiveSession, i: number) => manager.closeQuestionCommand(s, i),
        ],
        ['question:next', QuestionNextCommand, (s: LiveSession, i: number) => manager.nextQuestion(s, i)],
        ['question:back', QuestionBackCommand, (s: LiveSession, i: number) => manager.previousQuestion(s, i)],
        [
          'question:reopen',
          QuestionReopenCommand,
          (s: LiveSession, i: number) => manager.reopenQuestion(s, i),
        ],
      ] as const;
      for (const [event, schema, run] of indexCommands) {
        command(event, async (raw, ack) => {
          const parsed = schema.safeParse(raw);
          if (!parsed.success) return ackErr(ack, 'VALIDATION');
          const s = await getSession();
          if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
          const result = await run(s, parsed.data.expectedIndex);
          if (!result.ok) return ackErr(ack, result.code);
          ackOk(ack);
        });
      }

      command('session:end', async (_raw, ack) => {
        const s = await getSession();
        if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
        await manager.endSession(s);
        ackOk(ack);
      });

      command('participant:kick', async (raw, ack) => {
        const parsed = ParticipantKickCommand.safeParse(raw);
        if (!parsed.success) return ackErr(ack, 'VALIDATION');
        const s = await getSession();
        if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
        const result = await manager.kick(s, parsed.data.participantId);
        if (!result.ok) return ackErr(ack, result.code);
        ackOk(ack);
      });

      command('settings:update', async (raw, ack) => {
        const parsed = SettingsUpdateCommand.safeParse(raw ?? {});
        if (!parsed.success) return ackErr(ack, 'VALIDATION');
        const s = await getSession();
        if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
        const settings = await manager.updateSettings(s, parsed.data);
        ackOk(ack, { settings });
      });
    });
  },
  { name: 'live' },
);

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
    sessionManager: SessionManager;
  }
}
