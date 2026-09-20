// Socket.IO plugin (§6.1): namespaces /presenter and /participant, auth middlewares,
// per-socket rate limits, ack-based commands wired to the SessionManager.

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { Server as SocketIOServer, type Socket } from 'socket.io';

import {
  AnswerSubmitCommand,
  JoinCommand,
  ParticipantKickCommand,
  QuestionCloseCommand,
  QuestionBackCommand,
  QuestionNextCommand,
  QuestionReopenCommand,
  SessionStartCommand,
  SettingsUpdateCommand,
  errorMessage,
} from '@quiz/shared';

import { ACCESS_TOKEN_COOKIE } from '../lib/api.js';
import { SessionManager, presenterRoom } from '../modules/live/SessionManager.js';

/** socket.io middleware refusal carrying a machine-readable code in `err.data`. */
function socketError(code: string, message: string): Error & { data: { code: string } } {
  return Object.assign(new Error(message), { data: { code } });
}

// Simple token bucket keyed by socket id or client IP (§6.7).
class SocketLimiter {
  private counts = new Map<string, { n: number; resetAt: number }>();
  private takes = 0;
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}
  take(key: string, max = this.max): boolean {
    const nowMs = Date.now();
    // IP-keyed buckets are never released: sweep the expired ones now and then.
    if (++this.takes % 256 === 0) {
      for (const [k, b] of this.counts) if (b.resetAt < nowMs) this.counts.delete(k);
    }
    const bucket = this.counts.get(key);
    if (!bucket || bucket.resetAt < nowMs) {
      this.counts.set(key, { n: 1, resetAt: nowMs + this.windowMs });
      return true;
    }
    if (bucket.n >= max) return false;
    bucket.n += 1;
    return true;
  }
  /** Drops a socket's bucket on disconnect: keys are socket ids, never reused, so the map
   *  would otherwise grow by one entry per socket for the life of the process. */
  release(key: string): void {
    this.counts.delete(key);
  }
}

const answerLimiter = new SocketLimiter(5, 1000);
const joinLimiter = new SocketLimiter(5, 60_000);
const commandLimiter = new SocketLimiter(20, 1000);
// Per client IP: a room behind one NAT joins over a couple of minutes, a script filling the
// 500 seats from one machine does it in seconds. Bursts above these rates are refused
// RATE_LIMITED (the phone retries), so a bot is throttled, not the room.
const ipHandshakeLimiter = new SocketLimiter(120, 10_000);
const ipJoinLimiter = new SocketLimiter(60, 10_000);

/** Client IP as Caddy forwards it (the API port is never published, so the header is trusted). */
function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || socket.handshake.address;
}

export const livePlugin = fp(
  async (app: FastifyInstance) => {
    const io = new SocketIOServer(app.server, {
      path: '/socket.io',
      maxHttpBufferSize: 8 * 1024,
      pingInterval: 10_000,
      pingTimeout: 20_000,
      transports: ['websocket', 'polling'],
    });
    app.decorate('io', io);

    const manager = new SessionManager(io, app.prisma, () => app.config.PUBLIC_URL, app.log);
    app.decorate('sessionManager', manager);
    manager.loadAllOpen().catch((err: unknown) => app.log.error({ err }, 'boot-time session load failed'));

    // Graceful shutdown: disconnect everyone gently.
    app.addHook('onClose', async () => {
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

    // ---------------- /participant namespace ----------------
    io.of('/participant').use(async (socket, next) => {
      if (!ipHandshakeLimiter.take(clientIp(socket))) {
        return next(socketError('RATE_LIMITED', errorMessage('RATE_LIMITED')));
      }
      const token = (socket.handshake.auth as { token?: string }).token;
      if (!token) return next(); // anonymous — will participant:join
      let result: Awaited<ReturnType<typeof manager.resumeByToken>>;
      try {
        result = await manager.resumeByToken(socket, token);
      } catch (err) {
        app.log.error({ err }, 'participant resume failed');
        return next(socketError('INTERNAL', errorMessage('INTERNAL')));
      }
      if (!result.ok) return next(socketError(result.code, result.message));
      try {
        socket.emit('state:snapshot', await manager.participantSnapshot(result.s, result.participant));
        next();
      } catch (err) {
        // The resume already marked them online with this socket id and a refused handshake fires
        // no disconnect: roll presence back, or the panel would show them connected for good.
        app.log.error({ err }, 'participant snapshot failed');
        manager.markDisconnected(result.s, result.participant.id, socket.id);
        next(socketError('INTERNAL', errorMessage('INTERNAL')));
      }
    });

    io.of('/participant').on('connection', (socket: Socket) => {
      socket.on(
        'participant:join',
        guarded('participant:join', async (raw, ack) => {
          if (!joinLimiter.take(socket.id) || !ipJoinLimiter.take(clientIp(socket))) {
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
      let payload: { sub: string; email: string };
      try {
        payload = app.jwt.verify<{ sub: string; email: string }>(token.slice(cookiePrefix.length));
      } catch {
        return next(socketError('TOKEN_EXPIRED', 'Session expirée, reconnexion…'));
      }
      try {
        // Like the REST guard: a deactivated admin must not drive a stage until the JWT expires.
        const admin = await app.prisma.admin.findUnique({
          where: { id: payload.sub },
          select: { isActive: true },
        });
        if (!admin?.isActive) return next(socketError('UNAUTHORIZED', 'Non authentifié'));
        (socket.data as { adminId: string }).adminId = payload.sub;
        const sessionId = (socket.handshake.auth as { sessionId?: string }).sessionId;
        if (!sessionId) return next(socketError('UNAUTHORIZED', 'sessionId requis'));
        const s = await manager.getOrLoad(sessionId);
        if (!s) return next(socketError('SESSION_NOT_FOUND', 'Session inconnue'));
        if (s.presenterId !== payload.sub) {
          return next(socketError('FORBIDDEN', 'Vous n’êtes pas le présentateur'));
        }
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

      socket.on(
        'session:start',
        guarded('session:start', async (raw, ack) => {
          if (!commandLimiter.take(socket.id)) return ackErr(ack, 'RATE_LIMITED');
          const parsed = SessionStartCommand.safeParse(raw ?? {});
          const s = await getSession();
          if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
          const result = await manager.startSession(s, parsed.success ? !!parsed.data.force : false);
          if (!result.ok) return ackErr(ack, result.code);
          ackOk(ack);
        }),
      );

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
        socket.on(
          event,
          guarded(event, async (raw, ack) => {
            if (!commandLimiter.take(socket.id)) return ackErr(ack, 'RATE_LIMITED');
            const parsed = schema.safeParse(raw);
            if (!parsed.success) return ackErr(ack, 'VALIDATION');
            const s = await getSession();
            if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
            const result = await run(s, parsed.data.expectedIndex);
            if (!result.ok) return ackErr(ack, result.code);
            ackOk(ack);
          }),
        );
      }

      socket.on(
        'session:end',
        guarded('session:end', async (_raw, ack) => {
          const s = await getSession();
          if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
          await manager.endSession(s);
          ackOk(ack);
        }),
      );

      socket.on(
        'participant:kick',
        guarded('participant:kick', async (raw, ack) => {
          if (!commandLimiter.take(socket.id)) return ackErr(ack, 'RATE_LIMITED');
          const parsed = ParticipantKickCommand.safeParse(raw);
          if (!parsed.success) return ackErr(ack, 'VALIDATION');
          const s = await getSession();
          if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
          const result = await manager.kick(s, parsed.data.participantId);
          if (!result.ok) return ackErr(ack, result.code);
          ackOk(ack);
        }),
      );

      socket.on(
        'settings:update',
        guarded('settings:update', async (raw, ack) => {
          const parsed = SettingsUpdateCommand.safeParse(raw ?? {});
          if (!parsed.success) return ackErr(ack, 'VALIDATION');
          const s = await getSession();
          if (!s) return ackErr(ack, 'SESSION_NOT_FOUND');
          const settings = await manager.updateSettings(s, parsed.data);
          ackOk(ack, { settings });
        }),
      );
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
