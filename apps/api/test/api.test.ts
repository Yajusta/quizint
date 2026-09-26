// API integration tests (lot 9, §13) — fastify.inject on the real app + a real SQLite database.
// The test database is a throwaway file recreated from scratch by the `pretest` script on every run.
// Run: pnpm --filter @quiz/api test   (DATABASE_URL is set by vitest.config.ts, no .env needed)

import { crc32, deflateSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hash } from 'argon2';
import { createHmac } from 'node:crypto';

import {
  ADMIN_PASSWORD_MAX_LENGTH,
  CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE,
  ENDED_PURGE_DELAY_MS,
  IMAGE_MAX_INPUT_PIXELS,
  MAX_JOINS_PER_SECOND_PER_SESSION,
  SESSION_IDLE_TIMEOUT_MS,
} from '@quiz/shared';

import { buildApp } from '../src/app.js';
import { trustCaddyHop } from '../src/lib/proxy.js';
import { getConfig } from '../src/config.js';
import { JWT_AUDIENCE, JWT_ISSUER } from '../src/plugins/auth.js';
import { allowedOrigins } from '../src/plugins/csrf.js';
import { sha256 } from '../src/lib/api.js';
import { SessionManager } from '../src/modules/live/SessionManager.js';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

const TEST_EMAIL = 'test-admin@example.fr';
const TEST_PASSWORD = 'test-password-12';

let app: FastifyInstance;
let cookies = '';
let quizId = '';

beforeAll(async () => {
  app = await buildApp();
  // Seed a test admin directly.
  await app.prisma.admin.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: { email: TEST_EMAIL, displayName: 'Test', passwordHash: await hash(TEST_PASSWORD) },
  });
}, 30000);

afterAll(async () => {
  if (quizId) await app.prisma.quiz.delete({ where: { id: quizId } }).catch(() => undefined);
  await app.prisma.admin.delete({ where: { email: TEST_EMAIL } }).catch(() => undefined);
  await app.close();
});

function setCookieOf(res: { cookies: Array<{ name: string; value: string }> }): string {
  return res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

describe('health', () => {
  it('GET /healthz → ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('probe app', () => {
  // A second app, so test-only routes can be added before it is ready. It runs before any session
  // exists, so its boot load has nothing to pick up from the shared database.
  let probe: FastifyInstance;
  const ips: string[] = [];
  beforeAll(async () => {
    probe = await buildApp();
    probe.get('/ip', async (req) => {
      ips.push(req.ip);
      return {};
    });
    probe.get('/boom', async () => {
      throw new Error('Invalid `prisma.admin.findMany()` invocation: no such column: Admin.passwordHash');
    });
    probe.get('/teapot', async () => {
      throw Object.assign(new Error('short and stout'), { statusCode: 418 });
    });
    await probe.ready();
  }, 30000);
  afterAll(() => probe.close());

  it('a 5xx answers the generic INTERNAL envelope, never the raw error message', async () => {
    const res = await probe.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Erreur interne' } });
    expect(res.body).not.toContain('prisma');
  });

  it('a 4xx keeps the answer Fastify gives it', async () => {
    const teapot = await probe.inject({ method: 'GET', url: '/teapot' });
    expect(teapot.statusCode).toBe(418);
    expect(teapot.json().message).toBe('short and stout');
    const badJson = await probe.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email":',
    });
    expect(badJson.statusCode).toBe(400);
    expect(badJson.json().code).toBe('FST_ERR_CTP_INVALID_JSON_BODY');
  });

  it('a spoofed X-Forwarded-For does not choose the client IP', async () => {
    // Behind Caddy: the right-most entry, the one Caddy wrote, whatever the client prepended.
    await probe.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: '172.18.0.3',
      headers: { 'x-forwarded-for': '1.2.3.4, 198.51.100.7' },
    });
    // A directly reachable port: the header is not believed at all.
    await probe.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress: '203.0.113.50',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(ips).toEqual(['198.51.100.7', '203.0.113.50']);
  });
});

describe('auth', () => {
  it('login sets access + refresh cookies', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    cookies = setCookieOf(res);
    expect(cookies).toContain('access_token');
    expect(cookies).toContain('refresh_token');
  });

  it('me returns the admin', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies: cookiesObject(cookies) });
    expect(res.statusCode).toBe(200);
    expect(res.json().admin.email).toBe(TEST_EMAIL);
  });

  it('wrong password → 401 with uniform message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: TEST_EMAIL, password: 'wrong-password-1' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(res.json().error.message).toBe('Identifiants incorrects');
  });

  it('unknown email → same 401 as a wrong password (no enumeration)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nobody@example.fr', password: 'whatever-password-1' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
    expect(res.json().error.message).toBe('Identifiants incorrects');
  });

  it('two refreshes with the same cookie within the grace window both succeed; reuse later is theft', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    const first = cookiesObject(setCookieOf(login));
    // Two tabs of one browser refresh at the same moment: the loser of the race is not a thief.
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: first }),
      app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: first }),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    // One token in, one successor out: only the winner sets a refresh cookie, the loser an access one.
    const hasRefresh = (r: typeof a) => r.cookies.some((c) => c.name === 'refresh_token');
    expect([a, b].filter(hasRefresh)).toHaveLength(1);
    const rotated = cookiesObject(setCookieOf(hasRefresh(a) ? a : b));
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies: rotated });
    expect(me.statusCode).toBe(200);

    // The same old cookie presented long after its revocation is reuse: the family is revoked.
    await app.prisma.refreshToken.updateMany({
      where: { adminId: me.json().admin.id, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const reuse = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: first });
    expect(reuse.statusCode).toBe(401);
    const afterTheft = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: rotated });
    expect(afterTheft.statusCode).toBe(401);
    // Restore the cookies the rest of the suite relies on.
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    cookies = setCookieOf(relogin);
  });

  it('the rotation grace window is anchored on the first revocation and logout is immediate', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    const first = cookiesObject(setCookieOf(login));
    const rotate = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: first });
    expect(rotate.statusCode).toBe(200);
    const firstHash = sha256(first.refresh_token!);
    // Revoked 6 s ago: still inside the grace, a replay is accepted…
    const sixSecondsAgo = new Date(Date.now() - 6_000);
    await app.prisma.refreshToken.update({
      where: { tokenHash: firstHash },
      data: { revokedAt: sixSecondsAgo },
    });
    const replay = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: first });
    expect(replay.statusCode).toBe(200);
    // …with an access token only: the grace never mints a second refresh token.
    expect(replay.cookies.map((c) => c.name)).toEqual(['access_token']);
    // …but does not move the revocation time: the window closes 10 s after the *first* rotation.
    const row = await app.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: firstHash } });
    expect(row.revokedAt?.getTime()).toBe(sixSecondsAgo.getTime());

    // Logout expires the cookie outright: no grace, a replay is refused at once.
    const current = { ...cookiesObject(setCookieOf(rotate)), ...cookiesObject(setCookieOf(replay)) };
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies: current })).statusCode,
    ).toBe(204);
    const afterLogout = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: current });
    expect(afterLogout.statusCode).toBe(401);
    const relogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    cookies = setCookieOf(relogin);
  });

  it('me without cookies → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});

describe('quizzes', () => {
  it('CRUD + transactional questions', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/quizzes',
      cookies: cookiesObject(cookies),
      payload: { title: 'Quiz test vitest', description: null },
    });
    expect(created.statusCode).toBe(201);
    quizId = created.json().quiz.id;

    // Add 2 questions in one transactional PUT
    const put = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${quizId}/questions`,
      cookies: cookiesObject(cookies),
      payload: {
        questions: [
          {
            type: 'MCQ',
            prompt: '1+1 ?',
            choices: [
              { label: '2', isCorrect: true },
              { label: '3', isCorrect: false },
            ],
            pointsCorrect: 100,
            pointsWrong: 0,
            timeLimitSec: 30,
          },
          {
            type: 'TRUE_FALSE',
            prompt: 'Le ciel est bleu',
            choices: [
              { label: 'Vrai', isCorrect: true },
              { label: 'Faux', isCorrect: false },
            ],
            pointsCorrect: 50,
            pointsWrong: 0,
            timeLimitSec: null,
          },
        ],
      },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().quiz.questions).toHaveLength(2);

    // Reorder the two persisted questions (ids kept) and the choices of the first one:
    // (quizId, position) and (questionId, position) are unique, the swap must not collide.
    const saved = put.json().quiz.questions as Array<{
      id: string;
      prompt: string;
      choices: Array<{ id: string; label: string; isCorrect: boolean }>;
    }>;
    const [first, second] = saved as [(typeof saved)[number], (typeof saved)[number]];
    const swapped = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${quizId}/questions`,
      cookies: cookiesObject(cookies),
      payload: {
        questions: [
          {
            id: second.id,
            type: 'TRUE_FALSE',
            prompt: second.prompt,
            choices: second.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: c.isCorrect })),
            pointsCorrect: 50,
            pointsWrong: 0,
            timeLimitSec: null,
          },
          {
            id: first.id,
            type: 'MCQ',
            prompt: first.prompt,
            choices: [...first.choices]
              .reverse()
              .map((c) => ({ id: c.id, label: c.label, isCorrect: c.isCorrect })),
            pointsCorrect: 100,
            pointsWrong: 0,
            timeLimitSec: 30,
          },
        ],
      },
    });
    expect(swapped.statusCode).toBe(200);
    const reordered = swapped.json().quiz.questions as typeof saved;
    expect(reordered.map((q) => q.id)).toEqual([second.id, first.id]);
    expect(reordered[1]!.choices.map((c) => c.id)).toEqual([...first.choices].reverse().map((c) => c.id));

    // Invalid: MCQ without correct choice
    const invalid = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${quizId}/questions`,
      cookies: cookiesObject(cookies),
      payload: {
        questions: [
          {
            type: 'MCQ',
            prompt: 'bad',
            choices: [
              { label: 'a', isCorrect: false },
              { label: 'b', isCorrect: false },
            ],
            pointsCorrect: 100,
            pointsWrong: 0,
            timeLimitSec: null,
          },
        ],
      },
    });
    expect([400, 422]).toContain(invalid.statusCode);

    // List contains it
    const list = await app.inject({ method: 'GET', url: '/api/v1/quizzes', cookies: cookiesObject(cookies) });
    expect(list.json().quizzes.some((q: { id: string }) => q.id === quizId)).toBe(true);
  });

  it('export → import round trip', async () => {
    const exported = await app.inject({
      method: 'GET',
      url: `/api/v1/quizzes/${quizId}/export`,
      cookies: cookiesObject(cookies),
    });
    expect(exported.statusCode).toBe(200);
    const imported = await app.inject({
      method: 'POST',
      url: '/api/v1/quizzes/import',
      cookies: cookiesObject(cookies),
      payload: exported.json(),
    });
    expect(imported.statusCode).toBe(201);
    expect(imported.json().quiz.questionCount).toBe(2);
    // cleanup imported
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/quizzes/${imported.json().quiz.id}`,
      cookies: cookiesObject(cookies),
    });
  });
});

describe('sessions', () => {
  it('creates a session with a frozen snapshot and a unique code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quizId}/sessions`,
      cookies: cookiesObject(cookies),
      payload: {},
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(body.sessionId).toBeTruthy();
    expect(body.joinUrl).toContain(`/j/${body.code}`);
    const sid = body.sessionId;

    // Public join lookup
    const join = await app.inject({ method: 'GET', url: `/api/v1/join/${body.code}` });
    expect(join.statusCode).toBe(200);
    expect(join.json().quizTitle).toBe('Quiz test vitest');

    // No answer leakage in the public join payload (§10)
    expect(JSON.stringify(join.json())).not.toContain('isCorrect');

    // history detail: snapshot has the 2 questions
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sid}`,
      cookies: cookiesObject(cookies),
    });
    expect(detail.statusCode).toBe(200);
    const d = detail.json().session ?? detail.json();
    expect(d.quizSnapshot.title).toBe('Quiz test vitest');
    expect(d.quizSnapshot.questions ?? d.quizSnapshot?.quiz?.questions).toHaveLength(2);

    // Pagination query is validated: a non-numeric page is a 400, not a Prisma error.
    const badPage = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sid}/answers?page=abc`,
      cookies: cookiesObject(cookies),
    });
    expect(badPage.statusCode).toBe(400);
    expect(badPage.json().error.code).toBe('VALIDATION');
    const okPage = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sid}/answers?page=2&pageSize=5`,
      cookies: cookiesObject(cookies),
    });
    expect(okPage.statusCode).toBe(200);
    expect(okPage.json()).toMatchObject({ page: 2, answers: [] });
  });

  it('scores CSV ranks like the live final view and leaves kicked participants unranked', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quizId}/sessions`,
      cookies: cookiesObject(cookies),
      payload: {},
    });
    const sid = created.json().sessionId as string;
    const questionId = (await app.prisma.question.findFirstOrThrow({ where: { quizId } })).id;
    const mk = (nickname: string, score: number, isKicked = false) =>
      app.prisma.participant.create({
        data: {
          sessionId: sid,
          nickname,
          nicknameKey: nickname.toLowerCase(),
          tokenHash: `csv-test-${sid}-${nickname}`,
          score,
          isKicked,
        },
      });
    // Same score: the faster total correct time ranks first; the kicked one has the top score.
    const slow = await mk('Lent', 100);
    const fast = await mk('Rapide', 100);
    const kicked = await mk('Exclu', 500, true);
    const answer = (participantId: string, elapsedMs: number) =>
      app.prisma.answer.create({
        data: {
          sessionId: sid,
          participantId,
          questionId,
          questionIndex: 0,
          payload: { choiceId: 'x' },
          isCorrect: true,
          pointsBase: 100,
          pointsBonus: 0,
          pointsAwarded: 100,
          elapsedMs,
        },
      });
    await answer(slow.id, 5000);
    await answer(fast.id, 1000);
    await answer(kicked.id, 100);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sid}/export.csv?kind=scores`,
      cookies: cookiesObject(cookies),
    });
    expect(res.statusCode).toBe(200);
    const lines = res.body
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n');
    expect(lines.slice(1).map((l) => l.split(';').slice(0, 3).join(';'))).toEqual([
      '1;Rapide;100',
      '2;Lent;100',
      ';Exclu;500',
    ]);
    expect(lines[3]).toMatch(/;oui$/);

    // The history detail carries the same ranking (shared buildRanking): faster tie first, kicked out.
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sid}`,
      cookies: cookiesObject(cookies),
    });
    expect(detail.json().session.ranking).toEqual([
      { participantId: fast.id, nickname: 'Rapide', score: 100, rank: 1 },
      { participantId: slow.id, nickname: 'Lent', score: 100, rank: 2 },
    ]);
    // Cascade removes the participants and answers, so the shared quiz stays unplayed.
    await app.prisma.liveSession.delete({ where: { id: sid } });
  });
});

describe('media', () => {
  it('stores a GIF under the detected extension, never the client filename', async () => {
    const boundary = 'vitest-boundary';
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.html"\r\n` +
          'Content-Type: text/html\r\n\r\n',
      ),
      gif,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media',
      cookies: cookiesObject(cookies),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(201);
    const media = res.json().media;
    // Re-encoded like every image (animated WebP for a GIF): the client bytes are never served.
    expect(media.mimeType).toBe('image/webp');
    expect(media.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect(media.width).toBe(1);
    expect(media.height).toBe(1);
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/v1/media/${media.id}`,
      cookies: cookiesObject(cookies),
    });
    expect(del.statusCode).toBe(204);
  });

  it('a percent-encoded media path still requires authentication; /uploads stays public', async () => {
    const boundary = 'vitest-boundary-anon';
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="x.gif"\r\n` +
          'Content-Type: image/gif\r\n\r\n',
      ),
      gif,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
    const before = await app.prisma.media.count();
    for (const url of ['/api/v1/media', '/api/v1/%6Dedia', '/api/v1/m%65dia', '/api/v1/%6D%65dia']) {
      const res = await app.inject({ method: 'POST', url, headers, payload });
      expect(res.statusCode, url).toBe(401);
    }
    for (const url of [
      '/api/v1/media/00000000-0000-4000-8000-000000000000',
      '/api/v1/%6Dedia/00000000-0000-4000-8000-000000000000',
    ]) {
      const res = await app.inject({ method: 'DELETE', url });
      expect(res.statusCode, url).toBe(401);
    }
    expect(await app.prisma.media.count()).toBe(before);
    // The static route is outside the media plugin's guard: a missing file is a 404, not a 401.
    const statics = await app.inject({ method: 'GET', url: '/uploads/does-not-exist.webp' });
    expect(statics.statusCode).toBe(404);
  });

  /** Multipart body from raw parts: `file` parts carry a filename, the others are plain fields. */
  const multipartBody = (
    boundary: string,
    parts: Array<{ name: string; value: Buffer | string; filename?: string }>,
  ) =>
    Buffer.concat([
      ...parts.flatMap((p) => [
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"` +
            (p.filename ? `; filename="${p.filename}"\r\nContent-Type: application/octet-stream` : '') +
            '\r\n\r\n',
        ),
        Buffer.isBuffer(p.value) ? p.value : Buffer.from(p.value),
        Buffer.from('\r\n'),
      ]),
      Buffer.from(`--${boundary}--\r\n`),
    ]);
  const gifBytes = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  const upload = (boundary: string, payload: Buffer) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/media',
      cookies: cookiesObject(cookies),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });

  it('stray fields and a first file under another name are drained, not left hanging', async () => {
    const boundary = 'vitest-boundary-drain';
    const res = await upload(
      boundary,
      multipartBody(boundary, [
        { name: 'note', value: 'bonjour' },
        { name: 'file', value: gifBytes, filename: 'a.gif' },
        { name: 'after', value: 'ignored' },
      ]),
    );
    expect(res.statusCode).toBe(201);
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/media/${res.json().media.id}`,
      cookies: cookiesObject(cookies),
    });

    // A file under another field name is drained; the request then ends with no "file": 400.
    const other = await upload(
      boundary,
      multipartBody(boundary, [{ name: 'avatar', value: gifBytes, filename: 'b.gif' }]),
    );
    expect(other.statusCode).toBe(400);
  });

  it('multipart bounds: a second file or too many parts is a 413', async () => {
    const boundary = 'vitest-boundary-limits';
    const twoFiles = await upload(
      boundary,
      multipartBody(boundary, [
        { name: 'file', value: gifBytes, filename: 'a.gif' },
        { name: 'file', value: gifBytes, filename: 'b.gif' },
      ]),
    );
    expect(twoFiles.statusCode).toBe(413);
    const manyFields = await upload(
      boundary,
      multipartBody(boundary, [
        ...Array.from({ length: 10 }, (_, i) => ({ name: `f${i}`, value: 'x' })),
        { name: 'file', value: gifBytes, filename: 'a.gif' },
      ]),
    );
    expect(manyFields.statusCode).toBe(413);
  });

  it('an image whose header claims more than IMAGE_MAX_INPUT_PIXELS is refused before decoding', async () => {
    // A valid PNG signature and IHDR claiming 10 000 × 10 000 (100 MP), then an empty IDAT:
    // sharp reads the size from the header and refuses before allocating anything.
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body));
      return Buffer.concat([len, body, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(10_000, 0);
    ihdr.writeUInt32BE(10_000, 4);
    ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(Buffer.alloc(0))),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    expect(10_000 * 10_000).toBeGreaterThan(IMAGE_MAX_INPUT_PIXELS);
    const boundary = 'vitest-boundary-bomb';
    const res = await upload(
      boundary,
      multipartBody(boundary, [{ name: 'file', value: png, filename: 'b.png' }]),
    );
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('MEDIA_UNSUPPORTED_TYPE');
  });

  it('a question pointing at a media the library no longer holds is a 400 naming the question', async () => {
    const before = await app.inject({
      method: 'GET',
      url: `/api/v1/quizzes/${quizId}`,
      cookies: cookiesObject(cookies),
    });
    const questions = before.json().quiz.questions as Array<{ id: string; type: string; prompt: string }>;
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${quizId}/questions`,
      cookies: cookiesObject(cookies),
      payload: {
        questions: [
          {
            type: 'MCQ',
            prompt: 'Image disparue ?',
            mediaId: '00000000-0000-4000-8000-000000000000', // a stale 24 h draft
            choices: [
              { label: 'a', isCorrect: true },
              { label: 'b', isCorrect: false },
            ],
            pointsCorrect: 100,
            pointsWrong: 0,
            timeLimitSec: null,
          },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
    expect(res.json().error.details).toEqual({ question: 0, reason: 'media not found' });
    // Nothing was written: the transaction never started.
    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/quizzes/${quizId}`,
      cookies: cookiesObject(cookies),
    });
    expect(after.json().quiz.questions.map((q: { id: string }) => q.id)).toEqual(questions.map((q) => q.id));
  });
});

describe('account security', () => {
  const login = (email: string, password: string) =>
    app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });

  it('deactivation ends the account at once, not when its JWT expires', async () => {
    const email = 'colleague@example.fr';
    const password = 'colleague-pass-12';
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/admins',
      cookies: cookiesObject(cookies),
      payload: { email, displayName: 'Collègue', password },
    });
    expect(created.statusCode).toBe(201);
    const colleague = cookiesObject(setCookieOf(await login(email, password)));
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies: colleague })).statusCode).toBe(
      200,
    );

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admins/${created.json().admin.id}`,
      cookies: cookiesObject(cookies),
      payload: { isActive: false },
    });
    expect(patched.statusCode).toBe(200);
    // Same still-valid access JWT: refused immediately; the refresh token is dead too.
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies: colleague })).statusCode).toBe(
      401,
    );
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: colleague })).statusCode,
    ).toBe(401);
    await app.prisma.admin.delete({ where: { email } });
  });

  it('changing the password ends every other session and keeps this one', async () => {
    const other = cookiesObject(setCookieOf(await login(TEST_EMAIL, TEST_PASSWORD)));
    const mine = cookiesObject(cookies); // the suite's own session, the one that changes the password
    const changed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      cookies: mine,
      payload: { currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD },
    });
    expect(changed.statusCode).toBe(204);
    // Every access JWT signed before the change is refused at once, this browser's previous one
    // included — most likely signed in the very same second, which `iat` alone could not tell apart —
    // while the one change-password just handed back works.
    const me = (c: Record<string, string>) =>
      app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies: c });
    expect((await me(other)).statusCode).toBe(401);
    expect((await me(mine)).statusCode).toBe(401);
    expect((await me(cookiesObject(setCookieOf(changed)))).statusCode).toBe(200);
    // The other browser's refresh token is revoked; this browser got fresh cookies.
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: other })).statusCode,
    ).toBe(401);
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: cookiesObject(setCookieOf(changed)),
    });
    expect(refreshed.statusCode).toBe(200);
    // The suite keeps these (no extra login: the login route allows 10 per minute and per IP).
    cookies = setCookieOf(refreshed);
  });
});

describe('auth hardening', () => {
  // Logins from their own documentation-range addresses: the login route allows 10 per minute and
  // per IP, and the suite above already spends most of 127.0.0.1's budget.
  let nextIp = 1;
  const loginFrom = (email = TEST_EMAIL, password = TEST_PASSWORD) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: `203.0.113.${nextIp++}`,
      payload: { email, password },
    });
  const me = (c: Record<string, string>) => app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies: c });
  /** Hand-signed JWT, to try what our own signer never produces. */
  const forge = (header: Record<string, unknown>, claims: Record<string, unknown>, hmac = 'sha256') => {
    const input = `${b64url(header)}.${b64url(claims)}`;
    const sig = createHmac(hmac, getConfig().JWT_SECRET).update(input).digest('base64url');
    return `${input}.${sig}`;
  };

  it('PATCH /admins/:id refuses a password: nobody resets a colleague’s password', async () => {
    const self = (await me(cookiesObject(cookies))).json().admin.id as string;
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admins/${self}`,
      cookies: cookiesObject(cookies),
      payload: { password: 'thief-chosen-password-33' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION');
    // Nothing was written: the suite's password still signs in.
    expect((await loginFrom()).statusCode).toBe(200);
  });

  it('a password longer than ADMIN_PASSWORD_MAX_LENGTH is a 400 on every route', async () => {
    const long = 'x'.repeat(ADMIN_PASSWORD_MAX_LENGTH + 1);
    const login = await loginFrom(TEST_EMAIL, long);
    expect(login.statusCode).toBe(400);
    expect(login.json().error.code).toBe('INVALID_CREDENTIALS');
    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/admins',
      cookies: cookiesObject(cookies),
      payload: { email: 'long@example.fr', displayName: 'Long', password: long },
    });
    expect(create.statusCode).toBe(400);
    const change = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      cookies: cookiesObject(cookies),
      payload: { currentPassword: TEST_PASSWORD, newPassword: long },
    });
    expect(change.statusCode).toBe(400);
  });

  it('an access JWT with another algorithm, issuer or audience is refused', async () => {
    const admin = await app.prisma.admin.findUniqueOrThrow({ where: { email: TEST_EMAIL } });
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      sub: admin.id,
      email: admin.email,
      jti: 'forged',
      ...(admin.passwordChangedAt ? { pca: admin.passwordChangedAt.getTime() } : {}),
      iat: now,
      exp: now + 60,
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
    };
    const hs256 = { alg: 'HS256', typ: 'JWT' };
    const withToken = (token: string) => me({ access_token: token });
    // Control: the helper does produce a token the API accepts.
    expect((await withToken(forge(hs256, claims))).statusCode).toBe(200);
    expect((await withToken(forge({ alg: 'HS512', typ: 'JWT' }, claims, 'sha512'))).statusCode).toBe(401);
    expect((await withToken(`${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.`)).statusCode).toBe(
      401,
    );
    expect((await withToken(forge(hs256, { ...claims, iss: 'someone-else' }))).statusCode).toBe(401);
    expect((await withToken(forge(hs256, { ...claims, aud: 'someone-else' }))).statusCode).toBe(401);
    // Absent claims, not just wrong ones (fast-jwt would skip the check of a missing claim).
    for (const missing of ['iss', 'aud', 'exp'] as const) {
      const partial: Record<string, unknown> = { ...claims };
      delete partial[missing];
      expect((await withToken(forge(hs256, partial))).statusCode).toBe(401);
    }
  });

  it('logout ends the access JWT too, not 15 min later', async () => {
    const session = cookiesObject(setCookieOf(await loginFrom()));
    expect((await me(session)).statusCode).toBe(200);
    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies: session });
    expect(out.statusCode).toBe(204);
    expect((await me(session)).statusCode).toBe(401);
    // Only that token: the suite's own session is untouched.
    expect((await me(cookiesObject(cookies))).statusCode).toBe(200);
  });

  it('a stolen refresh token replayed inside the grace window mints no independent refresh token', async () => {
    const stolen = cookiesObject(setCookieOf(await loginFrom()));
    const { id: adminId } = (await me(stolen)).json().admin as { id: string };
    // The legitimate browser rotates first…
    const legit = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: stolen });
    expect(legit.statusCode).toBe(200);
    const live = () => app.prisma.refreshToken.count({ where: { adminId, revokedAt: null } });
    const before = await live();
    // …then the thief replays the copy within the grace: an access token, no refresh cookie, no row.
    const replay = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: stolen });
    expect(replay.statusCode).toBe(200);
    expect(replay.cookies.some((c) => c.name === 'refresh_token')).toBe(false);
    expect(await live()).toBe(before);
    // Once the grace is over, the same replay is theft: the whole family goes, legit browser included.
    await app.prisma.refreshToken.update({
      where: { tokenHash: sha256(stolen.refresh_token!) },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const late = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh', cookies: stolen });
    expect(late.statusCode).toBe(401);
    const legitAgain = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: cookiesObject(setCookieOf(legit)),
    });
    expect(legitAgain.statusCode).toBe(401);
    // Restore the suite's cookies (the family revocation took them too).
    cookies = setCookieOf(await loginFrom());
  });

  describe('CSRF', () => {
    const rename = async (headers: Record<string, string>) => {
      const self = (await me(cookiesObject(cookies))).json().admin.id as string;
      return app.inject({
        method: 'PATCH',
        url: `/api/v1/admins/${self}`,
        cookies: cookiesObject(cookies),
        headers,
        payload: { displayName: 'Test' },
      });
    };

    it('a cross-site or same-site browser request is refused', async () => {
      for (const site of ['cross-site', 'same-site']) {
        const res = await rename({ 'sec-fetch-site': site, origin: 'http://localhost:5173' });
        expect(res.statusCode).toBe(403);
        expect(res.json().error.code).toBe('FORBIDDEN');
      }
      // A browser without Fetch Metadata: the Origin alone decides.
      expect((await rename({ origin: 'https://evil.example' })).statusCode).toBe(403);
      expect((await rename({ origin: 'null' })).statusCode).toBe(403);
    });

    it('the app’s own origin, a typed URL and a non-browser client pass', async () => {
      expect(
        (await rename({ 'sec-fetch-site': 'same-origin', origin: 'http://localhost:5173' })).statusCode,
      ).toBe(200);
      // Vite listens on 127.0.0.1: outside production the loopback aliases of PUBLIC_URL are the app too.
      expect((await rename({ origin: 'http://127.0.0.1:5173' })).statusCode).toBe(200);
      expect((await rename({ 'sec-fetch-site': 'none' })).statusCode).toBe(200);
      expect((await rename({})).statusCode).toBe(200);
    });

    it('only the origin of PUBLIC_URL is allowed in production', () => {
      expect([...allowedOrigins('https://quiz.example.fr/', true)]).toEqual(['https://quiz.example.fr']);
      expect(allowedOrigins('http://localhost:5173', true).has('http://127.0.0.1:5173')).toBe(false);
      expect(allowedOrigins('http://localhost:5173', false).has('http://127.0.0.1:5173')).toBe(true);
      expect(allowedOrigins('https://quiz.example.fr', false).size).toBe(1);
    });
  });

  it('X-Forwarded-For is believed for exactly one hop, and only from a private peer', () => {
    expect(trustCaddyHop('172.18.0.3', 0)).toBe(true); // Caddy on the compose network
    expect(trustCaddyHop('::ffff:172.18.0.3', 0)).toBe(true);
    expect(trustCaddyHop('127.0.0.1', 0)).toBe(true);
    expect(trustCaddyHop('172.18.0.3', 1)).toBe(false); // the entry Caddy wrote is the client
    expect(trustCaddyHop('203.0.113.9', 0)).toBe(false); // a directly exposed port: header ignored
  });
});

describe('refresh token credential version', () => {
  // A dedicated admin: these tests change its password over and over, the suite's own must not move.
  const email = 'rotation@example.fr';
  const password = 'rotation-pass-12';
  // Own documentation-range addresses: the login route allows 10 per minute and per IP.
  let nextIp = 1;
  const login = async (as = email) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: `198.51.100.${nextIp++}`,
      payload: { email: as, password },
    });
    expect(res.statusCode).toBe(200);
    return cookiesObject(setCookieOf(res));
  };
  // The race test sends hundreds of refreshes: keep them out of the 127.0.0.1 global bucket the rest
  // of the file shares.
  const remoteAddress = '192.0.2.10';
  const refresh = (c: Record<string, string>) =>
    app.inject({ method: 'POST', url: '/api/v1/auth/refresh', remoteAddress, cookies: c });
  const me = (c: Record<string, string>) =>
    app.inject({ method: 'GET', url: '/api/v1/auth/me', remoteAddress, cookies: c });
  const changePassword = async (c: Record<string, string>) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      remoteAddress,
      cookies: c,
      payload: { currentPassword: password, newPassword: password },
    });
    expect(res.statusCode).toBe(204);
    return cookiesObject(setCookieOf(res));
  };
  const hasCookie = (res: { cookies: Array<{ name: string; value: string }> }, name: string) =>
    res.cookies.some((c) => c.name === name && c.value !== '');
  let adminId = '';

  beforeAll(async () => {
    adminId = (
      await app.prisma.admin.create({
        data: { email, displayName: 'Rotation', passwordHash: await hash(password) },
      })
    ).id;
  });

  afterAll(async () => {
    await app.prisma.admin.delete({ where: { email } }).catch(() => undefined);
  });

  it('a password change ends a refresh chain started before it', async () => {
    const victim = await login();
    const stolen = await login();
    const rotated = await refresh(stolen);
    expect(rotated.statusCode).toBe(200);
    const derived = cookiesObject(setCookieOf(rotated));

    const fresh = await changePassword(victim);
    for (const c of [stolen, derived]) {
      const res = await refresh(c);
      expect(res.statusCode).toBe(401);
      expect(hasCookie(res, 'access_token')).toBe(false);
      expect((await me(c)).statusCode).toBe(401);
    }
    // The browser that changed the password keeps going.
    expect((await me(fresh)).statusCode).toBe(200);
    const next = await refresh(fresh);
    expect(next.statusCode).toBe(200);
    expect((await me(cookiesObject(setCookieOf(next)))).statusCode).toBe(200);
  });

  it('a live row from an older credential version gets nothing, grace path included', async () => {
    const before = await app.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    await changePassword(await login());
    // What a rotation racing the revokeAdminSessions sweep used to leave behind: a live successor,
    // and a row revoked a second ago (inside the rotation grace), both from the previous version.
    const plant = async (revokedAt: Date | null) => {
      const token = `planted-${Math.random().toString(36).slice(2)}`;
      await app.prisma.refreshToken.create({
        data: {
          adminId,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt,
          credentialVersion: before.passwordChangedAt,
        },
      });
      return token;
    };
    for (const token of [await plant(null), await plant(new Date(Date.now() - 1000))]) {
      const res = await refresh({ refresh_token: token });
      expect(res.statusCode).toBe(401);
      expect(hasCookie(res, 'access_token')).toBe(false);
      expect(hasCookie(res, 'refresh_token')).toBe(false);
    }
  });

  it('replaying a token rotated before a password change does not end the sessions opened since', async () => {
    const before = await app.prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
    const fresh = await changePassword(await login());
    // A stolen token rotated a minute ago, before the change: beyond the grace, so plain reuse
    // detection would revoke the whole family, the post-change sessions included.
    const token = `rotated-${Math.random().toString(36).slice(2)}`;
    await app.prisma.refreshToken.create({
      data: {
        adminId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + 60 * 60_000),
        revokedAt: new Date(Date.now() - 60_000),
        credentialVersion: before.passwordChangedAt,
      },
    });
    expect((await refresh({ refresh_token: token })).statusCode).toBe(401);
    const next = await refresh(fresh);
    expect(next.statusCode).toBe(200);
    expect(hasCookie(next, 'refresh_token')).toBe(true);
  });

  it('a refresh chain racing a password change never survives it', async () => {
    // A fresh admin per round: change-password allows CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE per admin,
    // and twenty changes of one account within a minute would be (rightly) throttled.
    const passwordHash = await hash(password);
    for (let round = 0; round < 20; round++) {
      const raceEmail = `race-${round}@example.fr`;
      const { id: raceId } = await app.prisma.admin.create({
        data: { email: raceEmail, displayName: 'Race', passwordHash },
      });
      const victim = await login(raceEmail);
      const stolen = await login(raceEmail);
      // The thief rotates as fast as it can while the victim changes the password.
      const chain = async () => {
        let current = stolen;
        for (let step = 0; step < 50; step++) {
          const res = await refresh(current);
          if (res.statusCode !== 200 || !hasCookie(res, 'refresh_token')) break;
          current = cookiesObject(setCookieOf(res));
        }
        return current;
      };
      const [last, fresh] = await Promise.all([chain(), changePassword(victim)]);
      expect((await refresh(last)).statusCode).toBe(401);
      expect((await me(last)).statusCode).toBe(401);
      const { passwordChangedAt } = await app.prisma.admin.findUniqueOrThrow({ where: { id: raceId } });
      // No live row of an older version is left behind at all (the transaction), and the version
      // check in /auth/refresh would refuse one anyway (the test above).
      // NULL-safe: `NOT (col = ?)` alone would skip a NULL-version row.
      const stale = await app.prisma.refreshToken.count({
        where: {
          adminId: raceId,
          revokedAt: null,
          OR: [{ credentialVersion: null }, { NOT: { credentialVersion: passwordChangedAt } }],
        },
      });
      expect(stale).toBe(0);
      expect((await me(fresh)).statusCode).toBe(200);
      expect((await refresh(fresh)).statusCode).toBe(200);
      await app.prisma.admin.delete({ where: { id: raceId } });
    }
  }, 60_000);
});

describe('change-password rate limit', () => {
  // Dedicated admins and documentation-range addresses: the budget is per admin, and neither the
  // suite's admin nor 127.0.0.1's buckets must move.
  const password = 'guessed-pass-12';
  const emails = ['guess-target@example.fr', 'guess-bystander@example.fr'];
  let nextIp = 100;
  const login = async (email: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: `192.0.2.${nextIp++}`,
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    return cookiesObject(setCookieOf(res));
  };
  const changePassword = (remoteAddress: string, currentPassword: string, c?: Record<string, string>) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      remoteAddress,
      ...(c ? { cookies: c } : {}),
      payload: { currentPassword, newPassword: password },
    });

  beforeAll(async () => {
    const passwordHash = await hash(password);
    for (const email of emails) {
      await app.prisma.admin.create({ data: { email, displayName: 'Guess', passwordHash } });
    }
  });

  afterAll(async () => {
    await app.prisma.admin.deleteMany({ where: { email: { in: emails } } });
  });

  it('a stolen session cannot brute-force the current password, from any IP', async () => {
    const stolen = await login(emails[0]!);
    for (let i = 0; i < CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE; i++) {
      const res = await changePassword('192.0.2.200', `wrong-guess-${i}-pad`, stolen);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
    }
    const blocked = await changePassword('192.0.2.200', 'wrong-guess-last', stolen);
    expect(blocked.statusCode).toBe(429);
    // The bucket follows the admin, not the address: rotating IPs buys no extra guess, and the right
    // password is not even checked any more.
    expect((await changePassword('192.0.2.201', 'wrong-guess-moved', stolen)).statusCode).toBe(429);
    expect((await changePassword('192.0.2.202', password, stolen)).statusCode).toBe(429);
    // A token that does not verify, carrying the target's id, is refused by authenticate before the
    // limiter: 401, not the exhausted bucket's 429 — an unverified `sub` is never a key.
    const target = await app.prisma.admin.findUniqueOrThrow({ where: { email: emails[0]! } });
    const forged = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: target.id })}.bad-signature`;
    expect((await changePassword('192.0.2.203', password, { access_token: forged })).statusCode).toBe(401);
    // The account itself is untouched: nothing was changed, the session still works.
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', cookies: stolen })).statusCode).toBe(
      200,
    );
  });

  it('another admin, or requests without a valid token, do not use that budget', async () => {
    const bystander = await login(emails[1]!);
    // More token-less and forged requests from one address than the budget: none is counted (they
    // stop at authenticate), so they can neither fill the store nor turn an expired session's 401
    // (the one the client refreshes on) into a 429.
    const forged = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'nobody' })}.bad-signature`;
    for (let i = 0; i <= CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE; i++) {
      expect((await changePassword('192.0.2.204', password)).statusCode).toBe(401);
      expect((await changePassword('192.0.2.204', password, { access_token: forged })).statusCode).toBe(401);
    }
    // Same address, a valid session of another admin: its own, untouched budget.
    expect((await changePassword('192.0.2.204', password, bystander)).statusCode).toBe(204);
  });
});

describe('live engine', () => {
  /** Enough of a socket.io Socket for the SessionManager: an id, `data`, rooms. */
  const fakeSocket = (id: string, readyState = 'open') =>
    ({ id, data: {}, join: () => undefined, conn: { readyState } }) as unknown as Socket;

  /** A member of the real client, bound to it: Prisma methods must not run against a proxy. */
  const bound = (target: object, key: PropertyKey) => {
    const value = Reflect.get(target, key) as unknown;
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  };
  /**
   * Prisma delegates and client methods cannot be spied on (a restored spy leaves them broken):
   * a proxy of the client with a few members replaced, everything else forwarded.
   */
  const prismaWith = (overrides: Record<string, unknown>) =>
    new Proxy(app.prisma, {
      get(target, key) {
        if (typeof key === 'string' && key in overrides) return overrides[key];
        return bound(target, key);
      },
    });

  type QuestionPayload = Record<string, unknown>;
  const mcq = (extra: QuestionPayload = {}): QuestionPayload => ({
    type: 'MCQ',
    prompt: 'Capitale de la France ?',
    pointsCorrect: 100,
    pointsWrong: 0,
    timeLimitSec: null,
    choices: [
      { label: 'Paris', isCorrect: true },
      { label: 'Lyon', isCorrect: false },
    ],
    ...extra,
  });
  const numeric = (extra: QuestionPayload = {}): QuestionPayload => ({
    type: 'NUMERIC',
    prompt: 'Combien ?',
    pointsCorrect: 100,
    pointsWrong: 0,
    timeLimitSec: null,
    choices: [],
    numericAnswer: { value: 42, tolerance: 0, toleranceMode: 'ABSOLUTE' },
    ...extra,
  });

  async function createQuiz(title: string, questions: QuestionPayload[]) {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/quizzes',
      cookies: cookiesObject(cookies),
      payload: { title, description: null },
    });
    const id = created.json().quiz.id as string;
    const put = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${id}/questions`,
      cookies: cookiesObject(cookies),
      payload: { questions },
    });
    expect(put.statusCode).toBe(200);
    return {
      id,
      questions: put.json().quiz.questions as Array<
        QuestionPayload & { id: string; choices: Array<{ id: string; label: string; isCorrect: boolean }> }
      >,
    };
  }

  async function createLiveSession(quiz: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quiz}/sessions`,
      cookies: cookiesObject(cookies),
      payload: {},
    });
    const { sessionId, code } = res.json() as { sessionId: string; code: string };
    const s = await app.sessionManager.getOrLoad(sessionId);
    if (!s) throw new Error('session not loaded');
    return { sessionId, code, s };
  }

  async function joinAs(code: string, nickname: string, socketId = `sock-${nickname}`) {
    const result = await app.sessionManager.join(fakeSocket(socketId), code, nickname);
    if (!result.ok) throw new Error(result.code);
    return result;
  }

  it('a quiz with a session that is not over keeps every question, answered or not', async () => {
    const quiz = await createQuiz('Quiz en salle d’attente', [mcq(), numeric()]);
    const { s } = await createLiveSession(quiz.id); // LOBBY, nothing answered yet
    const put = (questions: QuestionPayload[]) =>
      app.inject({
        method: 'PUT',
        url: `/api/v1/quizzes/${quiz.id}/questions`,
        cookies: cookiesObject(cookies),
        payload: { questions },
      });
    const first = quiz.questions[0]!;
    const keptMcq = {
      ...mcq({ choices: first.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: c.isCorrect })) }),
      id: first.id,
    };
    // Dropping the numeric question would break every answer of that round (FK on the snapshot id).
    const dropped = await put([keptMcq]);
    expect(dropped.statusCode).toBe(423);
    expect(dropped.json().error.details.reason).toBe('played question removed');
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/quizzes/${quiz.id}`,
      cookies: cookiesObject(cookies),
    });
    expect(detail.json().quiz.isLocked).toBe(true);

    // Once the session is over (and still unanswered), the question can go.
    await app.sessionManager.endSession(s);
    expect((await put([keptMcq])).statusCode).toBe(200);
  });

  it('boot load arms the idle timer of a LOBBY session left behind by a restart', async () => {
    const quiz = await createQuiz('Quiz lobby avant redémarrage', [mcq()]);
    const { sessionId } = await createLiveSession(quiz.id);
    const manager = app.sessionManager as unknown as {
      forget: (id: string) => void;
      sessions: Map<string, { idleTimer: NodeJS.Timeout | null }>;
    };
    manager.forget(sessionId); // as if the process had restarted
    expect(manager.sessions.has(sessionId)).toBe(false);
    await app.sessionManager.loadAllOpen();
    expect(manager.sessions.get(sessionId)?.idleTimer).not.toBeNull();
    await app.sessionManager.endSession((await app.sessionManager.getOrLoad(sessionId))!);
  });

  it('lastPlayedAt comes from the last started session, not from a newer cancelled lobby', async () => {
    const quiz = await createQuiz('Quiz dernière lecture', [mcq()]);
    const played = await createLiveSession(quiz.id);
    const startedAt = new Date('2026-09-14T10:00:00Z');
    await app.prisma.liveSession.update({
      where: { id: played.sessionId },
      data: { phase: 'ENDED', startedAt, endedAt: new Date('2026-09-14T10:30:00Z') },
    });
    const lobby = await createLiveSession(quiz.id); // newer, never started
    await app.sessionManager.endSession(lobby.s); // CANCELLED: startedAt stays null
    const res = await app.inject({ method: 'GET', url: '/api/v1/quizzes', cookies: cookiesObject(cookies) });
    const row = (res.json().quizzes as Array<{ id: string; lastPlayedAt: number | null }>).find(
      (q) => q.id === quiz.id,
    );
    expect(row?.lastPlayedAt).toBe(startedAt.getTime());
    await app.sessionManager.endSession(played.s);
  });

  it('two simultaneous joins with one nickname: one wins, the other gets NICKNAME_TAKEN', async () => {
    const quiz = await createQuiz('Quiz join concurrent', [mcq()]);
    const { code } = await createLiveSession(quiz.id);
    const results = await Promise.all([
      app.sessionManager.join(fakeSocket('a'), code, 'Marie'),
      app.sessionManager.join(fakeSocket('b'), code, 'marie'),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, code: 'NICKNAME_TAKEN' });
  });

  /** The last idle-eviction callback armed through the spied `setTimeout`. */
  const lastIdleCallback = (spy: { mock: { calls: unknown[][] } }) => {
    const armed = spy.mock.calls.filter((call) => call[1] === SESSION_IDLE_TIMEOUT_MS).at(-1);
    expect(armed).toBeDefined();
    return armed![0] as () => void;
  };

  it('a lobby nobody starts is ended after SESSION_IDLE_TIMEOUT_MS, re-armed by joins', async () => {
    const quiz = await createQuiz('Quiz lobby oublié', [mcq()]);
    const spy = vi.spyOn(globalThis, 'setTimeout');
    try {
      const { sessionId, code, s } = await createLiveSession(quiz.id);
      const idle = s as unknown as { idleTimer: NodeJS.Timeout | null };
      expect(idle.idleTimer).not.toBeNull();
      const armedAtLoad = idle.idleTimer;

      await joinAs(code, 'Retardataire');
      expect(idle.idleTimer).not.toBe(armedAtLoad); // a join re-arms the timer

      // Fire the armed callback by hand instead of waiting six hours.
      lastIdleCallback(spy)();
      await vi.waitFor(async () => {
        const row = await app.prisma.liveSession.findUniqueOrThrow({ where: { id: sessionId } });
        expect(row.phase).toBe('ENDED');
        expect(row.startedAt).toBeNull(); // reason CANCELLED
      });
      expect(idle.idleTimer).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('a run abandoned after the final ranking is ended by the same idle timer', async () => {
    const quiz = await createQuiz('Quiz abandonné', [mcq()]);
    const spy = vi.spyOn(globalThis, 'setTimeout');
    try {
      const { sessionId, code, s } = await createLiveSession(quiz.id);
      await joinAs(code, 'Prompt');
      const idle = s as unknown as { idleTimer: NodeJS.Timeout | null };
      const armedAtJoin = idle.idleTimer;
      expect(await app.sessionManager.startSession(s, false)).toEqual({ ok: true });
      expect(idle.idleTimer).not.toBe(armedAtJoin); // every presenter command re-arms it
      expect(await app.sessionManager.closeQuestionCommand(s, 0)).toEqual({ ok: true });
      expect(await app.sessionManager.nextQuestion(s, 0)).toEqual({ ok: true });
      expect(s.phase).toBe('FINAL_RANKING');
      expect(idle.idleTimer).not.toBeNull();

      // The presenter closed the tab without ending the session.
      lastIdleCallback(spy)();
      await vi.waitFor(async () => {
        const row = await app.prisma.liveSession.findUniqueOrThrow({ where: { id: sessionId } });
        expect(row.phase).toBe('ENDED');
        expect(row.startedAt).not.toBeNull(); // reason ENDED, not CANCELLED
      });
      expect(idle.idleTimer).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('an ENDED session loaded after its purge is dropped again, not cached for good', async () => {
    const quiz = await createQuiz('Quiz terminé tardif', [mcq()]);
    const { sessionId, s } = await createLiveSession(quiz.id);
    await app.sessionManager.endSession(s);
    const spy = vi.spyOn(globalThis, 'setTimeout');
    try {
      // Simulate the post-end purge, then a late touch (a phone's socket disconnecting).
      (app.sessionManager as unknown as { forget: (id: string) => void }).forget(sessionId);
      const reloaded = await app.sessionManager.getOrLoad(sessionId);
      expect(reloaded?.phase).toBe('ENDED');
      const purge = spy.mock.calls.filter(([, ms]) => ms === ENDED_PURGE_DELAY_MS).at(-1);
      expect(purge).toBeDefined();
      (purge![0] as () => void)();
      expect(await app.sessionManager.getOrLoad(sessionId)).not.toBe(reloaded); // rebuilt, not cached
    } finally {
      spy.mockRestore();
    }
  });

  it('a join stampede beyond MAX_JOINS_PER_SECOND_PER_SESSION is rate limited per session', async () => {
    const quiz = await createQuiz('Quiz ruée', [mcq()]);
    const { code } = await createLiveSession(quiz.id);
    const results = await Promise.all(
      Array.from({ length: MAX_JOINS_PER_SECOND_PER_SESSION + 1 }, (_, i) =>
        app.sessionManager.join(fakeSocket(`stampede-${i}`), code, `Invité${i}`),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(MAX_JOINS_PER_SECOND_PER_SESSION);
    expect(results.filter((r) => !r.ok).map((r) => (r as { code: string }).code)).toEqual(['RATE_LIMITED']);
  });

  it('the old socket of a resumed participant closing does not mark them offline', async () => {
    const quiz = await createQuiz('Quiz reprise', [mcq()]);
    const { code, s } = await createLiveSession(quiz.id);
    const { participant, token } = await joinAs(code, 'Yanis', 'sock-wifi');
    const resumed = await app.sessionManager.resumeByToken(fakeSocket('sock-4g'), token);
    expect(resumed.ok).toBe(true);

    app.sessionManager.markDisconnected(s, participant.id, 'sock-wifi');
    expect(participant.connected).toBe(true);
    expect(participant.socketId).toBe('sock-4g');

    app.sessionManager.markDisconnected(s, participant.id, 'sock-4g');
    expect(participant.connected).toBe(false);
  });

  it('stepping back discards the answers and rolls the scores back', async () => {
    const quiz = await createQuiz('Quiz retour', [mcq(), mcq()]);
    const { sessionId, code, s } = await createLiveSession(quiz.id);
    const { participant } = await joinAs(code, 'Bruno');
    await app.sessionManager.startSession(s, false);
    const correctOf = (i: number) => s.quizSnapshot.questions[i]!.choices.find((c) => c.isCorrect)!.id;
    const scoreInDb = async () =>
      (await app.prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).score;

    // Q1 answered and closed; the snapshot of a presenter coming back carries the result.
    await app.sessionManager.submitAnswer(s, participant, 0, { choiceId: correctOf(0) });
    await app.sessionManager.closeQuestionCommand(s, 0);
    const q1Score = participant.score;
    expect(q1Score).toBeGreaterThan(0);
    expect((await app.sessionManager.presenterSnapshot(s)).roundResult).toMatchObject({
      questionIndex: 0,
      answersCount: 1,
    });
    expect((await app.sessionManager.participantSnapshot(s, participant)).roundResult).toMatchObject({
      questionIndex: 0,
      totalScore: q1Score,
    });

    // Reopen Q1: its answer, its result and its points are gone.
    expect(await app.sessionManager.reopenQuestion(s, 0)).toEqual({ ok: true });
    expect(s.phase).toBe('QUESTION_OPEN');
    expect(participant.score).toBe(0);
    expect(await scoreInDb()).toBe(0);
    expect(await app.prisma.answer.count({ where: { sessionId } })).toBe(0);
    expect(await app.prisma.questionResult.count({ where: { sessionId } })).toBe(0);

    // Replay Q1, open Q2, answer it, then go back to Q1's result: only Q2's answer is dropped.
    await app.sessionManager.submitAnswer(s, participant, 0, { choiceId: correctOf(0) });
    expect(await app.sessionManager.closeQuestionCommand(s, 0)).toEqual({ ok: true });
    await app.sessionManager.nextQuestion(s, 0);
    await app.sessionManager.submitAnswer(s, participant, 1, { choiceId: correctOf(1) });
    expect(await app.sessionManager.previousQuestion(s, 0)).toMatchObject({ code: 'INDEX_MISMATCH' });
    expect(await app.sessionManager.previousQuestion(s, 1)).toEqual({ ok: true });
    expect(s.phase).toBe('QUESTION_CLOSED');
    expect(s.currentQuestionIndex).toBe(0);
    expect(participant.score).toBe(q1Score);
    expect(await scoreInDb()).toBe(q1Score);
    expect(await app.prisma.answer.count({ where: { sessionId } })).toBe(1);
    const row = await app.prisma.liveSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row).toMatchObject({ phase: 'QUESTION_CLOSED', currentQuestionIndex: 0 });

    // The first question has no previous result.
    await app.sessionManager.reopenQuestion(s, 0);
    expect(await app.sessionManager.previousQuestion(s, 0)).toMatchObject({ code: 'INVALID_PHASE' });
  });

  it('a presenter coming back on the final ranking gets it in the snapshot', async () => {
    const quiz = await createQuiz('Quiz reprise classement', [mcq()]);
    const { s } = await createLiveSession(quiz.id);
    await app.sessionManager.startSession(s, true);
    await app.sessionManager.closeQuestionCommand(s, 0);
    await app.sessionManager.nextQuestion(s, 0);
    expect(s.phase).toBe('FINAL_RANKING');
    expect((await app.sessionManager.presenterSnapshot(s)).final).toMatchObject({ ranking: [] });
  });

  it('archive, restore, then permanent deletion with every session of the quiz', async () => {
    const quiz = await createQuiz('Quiz à archiver', [mcq()]);
    const req = (method: 'GET' | 'POST' | 'DELETE', url: string) =>
      app.inject({ method, url: `/api/v1${url}`, cookies: cookiesObject(cookies) });
    const listed = async (archived: boolean) =>
      (
        (await req('GET', `/quizzes${archived ? '?archived=true' : ''}`)).json().quizzes as Array<{
          id: string;
        }>
      )
        .map((q) => q.id)
        .includes(quiz.id);

    // A session in progress blocks the archive; ended, it does not.
    const { sessionId, code, s } = await createLiveSession(quiz.id);
    await joinAs(code, 'Chloé');
    expect((await req('POST', `/quizzes/${quiz.id}/archive`)).statusCode).toBe(409);
    await app.sessionManager.endSession(s);

    // A library quiz cannot be deleted outright.
    expect((await req('DELETE', `/quizzes/${quiz.id}`)).json()).toMatchObject({
      error: { code: 'QUIZ_NOT_ARCHIVED' },
    });

    expect((await req('POST', `/quizzes/${quiz.id}/archive`)).statusCode).toBe(204);
    expect(await listed(false)).toBe(false);
    expect(await listed(true)).toBe(true);
    // Archived: no new session, no edition.
    expect((await req('POST', `/quizzes/${quiz.id}/sessions`)).statusCode).toBe(404);
    expect((await req('GET', `/quizzes/${quiz.id}`)).statusCode).toBe(404);

    expect((await req('POST', `/quizzes/${quiz.id}/restore`)).statusCode).toBe(204);
    expect(await listed(false)).toBe(true);

    await req('POST', `/quizzes/${quiz.id}/archive`);
    expect((await req('DELETE', `/quizzes/${quiz.id}`)).statusCode).toBe(204);
    expect(await listed(true)).toBe(false);
    expect(await app.prisma.quiz.count({ where: { id: quiz.id } })).toBe(0);
    expect(await app.prisma.liveSession.count({ where: { id: sessionId } })).toBe(0);
    expect(await app.prisma.participant.count({ where: { sessionId } })).toBe(0);
  });

  it('closing a question re-sends the participants list with the updated scores', async () => {
    const quiz = await createQuiz('Quiz scores panneau', [mcq()]);
    const { code, s } = await createLiveSession(quiz.id);
    const { participant } = await joinAs(code, 'Inès');
    await app.sessionManager.startSession(s, false);
    const correct = s.quizSnapshot.questions[0]!.choices.find((c) => c.isCorrect)!;
    await app.sessionManager.submitAnswer(s, participant, 0, { choiceId: correct.id });

    const manager = app.sessionManager as unknown as { broadcastParticipantsList: (s: unknown) => void };
    const broadcast = vi.spyOn(manager, 'broadcastParticipantsList');
    await app.sessionManager.closeQuestionCommand(s, 0);
    expect(broadcast).toHaveBeenCalledTimes(1);
    broadcast.mockRestore();
  });

  it('a free-text poll groups normalised answers, scores nothing and shows the list to everyone', async () => {
    const quiz = await createQuiz('Quiz texte libre', [
      { type: 'TEXT_POLL', prompt: 'En un mot ?', pointsCorrect: 0, pointsWrong: 0, choices: [] },
    ]);
    const { sessionId, code, s } = await createLiveSession(quiz.id);
    const { participant: ines } = await joinAs(code, 'Inès');
    const { participant: karim } = await joinAs(code, 'Karim');
    const { participant: lea } = await joinAs(code, 'Léa');
    await app.sessionManager.startSession(s, false);

    expect(await app.sessionManager.submitAnswer(s, ines, 0, { text: '   ' })).toMatchObject({
      ok: false,
      code: 'INVALID_TEXT',
    });
    expect(await app.sessionManager.submitAnswer(s, ines, 0, { text: 'x'.repeat(81) })).toMatchObject({
      ok: false,
      code: 'INVALID_TEXT',
    });
    expect((await app.sessionManager.submitAnswer(s, ines, 0, { text: '  Très   bien ' })).ok).toBe(true);
    expect((await app.sessionManager.submitAnswer(s, karim, 0, { text: 'tres BIEN !' })).ok).toBe(true);
    expect((await app.sessionManager.submitAnswer(s, lea, 0, { text: '=Lent' })).ok).toBe(true);
    await app.sessionManager.closeQuestionCommand(s, 0);

    const stored = await app.prisma.answer.findFirstOrThrow({ where: { sessionId, participantId: ines.id } });
    expect(stored.payload).toEqual({ text: 'Très bien' });
    expect(stored.pointsAwarded).toBe(0);
    expect(stored.isCorrect).toBeNull();

    const expected = [
      { text: 'TRES BIEN', count: 2 },
      { text: 'LENT', count: 1 },
    ];
    const result = await app.prisma.questionResult.findFirstOrThrow({
      where: { sessionId, questionIndex: 0 },
    });
    expect(result.distribution).toEqual({ kind: 'TEXT', entries: expected });
    const snap = await app.sessionManager.participantSnapshot(s, lea);
    expect(snap.roundResult).toMatchObject({ correctAnswer: null, textEntries: expected, pointsAwarded: 0 });

    const csv = await app.inject({
      method: 'GET',
      url: `/api/v1/sessions/${sessionId}/export.csv?kind=answers`,
      cookies: cookiesObject(cookies),
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.body).toContain('Très bien');
    expect(csv.body).toContain("'=Lent"); // never read back as a formula
  });

  let playedQuiz: Awaited<ReturnType<typeof createQuiz>>;

  it('an answer racing the close is part of the round result', async () => {
    playedQuiz = await createQuiz('Quiz joué', [mcq(), numeric()]);
    const { sessionId, code, s } = await createLiveSession(playedQuiz.id);
    const { participant } = await joinAs(code, 'Alice');
    expect(await app.sessionManager.startSession(s, false)).toEqual({ ok: true });

    const correct = s.quizSnapshot.questions[0]!.choices.find((c) => c.isCorrect)!;
    const [answer, close] = await Promise.all([
      app.sessionManager.submitAnswer(s, participant, 0, { choiceId: correct.id }),
      app.sessionManager.closeQuestionCommand(s, 0),
    ]);
    expect(answer.ok).toBe(true);
    expect(close).toEqual({ ok: true });
    const result = await app.prisma.questionResult.findFirstOrThrow({
      where: { sessionId, questionIndex: 0 },
    });
    expect(result.answersCount).toBe(1);
    expect(result.correctCount).toBe(1);
  });

  it('played questions keep their correct answer; foreign ids are refused; a refused PUT writes nothing', async () => {
    const [played, unplayed] = playedQuiz.questions as [
      (typeof playedQuiz.questions)[number],
      (typeof playedQuiz.questions)[number],
    ];
    const put = (questions: QuestionPayload[]) =>
      app.inject({
        method: 'PUT',
        url: `/api/v1/quizzes/${playedQuiz.id}/questions`,
        cookies: cookiesObject(cookies),
        payload: { questions },
      });
    const keepChoices = (q: typeof played) =>
      q.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: c.isCorrect }));

    // Correct choice swapped on the played MCQ.
    const flipped = await put([
      mcq({
        id: played.id,
        choices: played.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: !c.isCorrect })),
      }),
      numeric({ id: unplayed.id }),
    ]);
    expect(flipped.statusCode).toBe(423);
    expect(flipped.json().error.code).toBe('QUIZ_LOCKED');

    // Played question sent back without its choice ids, next to an edit of another question.
    const withoutIds = await put([
      mcq({
        id: played.id,
        choices: played.choices.map((c) => ({ label: c.label, isCorrect: c.isCorrect })),
      }),
      numeric({ id: unplayed.id, prompt: 'Modifié ?' }),
    ]);
    expect(withoutIds.statusCode).toBe(423);
    const after = await app.prisma.question.findUniqueOrThrow({ where: { id: unplayed.id } });
    expect(after.prompt).toBe('Combien ?');

    // A choice id belonging to another question.
    const other = await createQuiz('Quiz tiers', [mcq()]);
    const foreignChoice = await put([
      mcq({ id: played.id, choices: keepChoices(played) }),
      mcq({
        id: unplayed.id,
        choices: [
          { id: other.questions[0]!.choices[0]!.id, label: 'X', isCorrect: true },
          { label: 'Y', isCorrect: false },
        ],
      }),
    ]);
    expect(foreignChoice.statusCode).toBe(400);

    // A question id from another quiz.
    const foreignQuestion = await put([
      mcq({ id: played.id, choices: keepChoices(played) }),
      mcq({ id: other.questions[0]!.id }),
    ]);
    expect(foreignQuestion.statusCode).toBe(400);
    const otherQuestion = await app.prisma.question.findUniqueOrThrow({
      where: { id: other.questions[0]!.id },
    });
    expect(otherQuestion.quizId).toBe(other.id);

    // Unchanged played question + edited unplayed one still saves.
    const ok = await put([
      mcq({ id: played.id, choices: keepChoices(played) }),
      numeric({ id: unplayed.id, prompt: 'Modifié ?' }),
    ]);
    expect(ok.statusCode).toBe(200);
  });

  it('a played numeric question keeps its expected value', async () => {
    const quiz = await createQuiz('Quiz numérique joué', [numeric()]);
    const { code, s } = await createLiveSession(quiz.id);
    const { participant } = await joinAs(code, 'Zoé');
    await app.sessionManager.startSession(s, false);
    expect((await app.sessionManager.submitAnswer(s, participant, 0, { value: '42' })).ok).toBe(true);

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${quiz.id}/questions`,
      cookies: cookiesObject(cookies),
      payload: {
        questions: [
          numeric({
            id: quiz.questions[0]!.id,
            numericAnswer: { value: 43, tolerance: 0, toleranceMode: 'ABSOLUTE' },
          }),
        ],
      },
    });
    expect(res.statusCode).toBe(423);
    expect(res.json().error.details.reason).toBe('correct answer changed');
  });

  it('deleting the played session keeps the quiz locked; duplication stays the escape hatch', async () => {
    const quiz = await createQuiz('Quiz joué puis purgé', [mcq(), numeric()]);
    const { sessionId, code, s } = await createLiveSession(quiz.id);
    const { participant } = await joinAs(code, 'Rgpd');
    await app.sessionManager.startSession(s, false);
    const choiceId = s.quizSnapshot.questions[0]!.choices[0]!.id;
    expect((await app.sessionManager.submitAnswer(s, participant, 0, { choiceId })).ok).toBe(true);

    // Deleted while still running: the route ends it, records the answered question, then deletes.
    const gone = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sessions/${sessionId}`,
      cookies: cookiesObject(cookies),
    });
    expect(gone.statusCode).toBe(204);
    expect(await app.prisma.answer.count({ where: { sessionId } })).toBe(0);

    const [played, unplayed] = quiz.questions as [
      (typeof quiz.questions)[number],
      (typeof quiz.questions)[number],
    ];
    const flipped = [
      mcq({
        id: played.id,
        choices: played.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: !c.isCorrect })),
      }),
      numeric({ id: unplayed.id }),
    ];
    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${quiz.id}/questions`,
      cookies: cookiesObject(cookies),
      payload: { questions: flipped },
    });
    expect(res.statusCode).toBe(423);
    expect(res.json().error.code).toBe('QUIZ_LOCKED');
    expect(res.json().error.details).toEqual({ questionId: played.id, reason: 'correct answer changed' });
    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/quizzes/${quiz.id}`,
      cookies: cookiesObject(cookies),
    });
    expect(detail.json().quiz.isLocked).toBe(true);

    // The question never answered is still editable next to the unchanged played one.
    const editUnplayed = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${quiz.id}/questions`,
      cookies: cookiesObject(cookies),
      payload: {
        questions: [
          mcq({
            id: played.id,
            choices: played.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: c.isCorrect })),
          }),
          numeric({ id: unplayed.id, prompt: 'Combien, vraiment ?' }),
        ],
      },
    });
    expect(editUnplayed.statusCode).toBe(200);

    // The duplicate is a fresh, unplayed quiz: the same change goes through there.
    const dup = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quiz.id}/duplicate`,
      cookies: cookiesObject(cookies),
    });
    expect(dup.statusCode).toBe(201);
    const copyId = dup.json().quiz.id as string;
    const copy = await app.inject({
      method: 'GET',
      url: `/api/v1/quizzes/${copyId}`,
      cookies: cookiesObject(cookies),
    });
    expect(copy.json().quiz.isLocked).toBe(false);
    const [copyPlayed, copyUnplayed] = copy.json().quiz.questions as Array<{
      id: string;
      choices: Array<{ id: string; label: string; isCorrect: boolean }>;
    }>;
    const copyFlip = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${copyId}/questions`,
      cookies: cookiesObject(cookies),
      payload: {
        questions: [
          mcq({
            id: copyPlayed!.id,
            choices: copyPlayed!.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: !c.isCorrect })),
          }),
          numeric({ id: copyUnplayed!.id }),
        ],
      },
    });
    expect(copyFlip.statusCode).toBe(200);
  });

  it('the lock is re-asserted inside the save transaction (a session created mid-save wins)', async () => {
    const quiz = await createQuiz('Quiz TOCTOU', [mcq(), numeric()]);
    const first = quiz.questions[0]!;
    const keptMcq = {
      ...mcq({ choices: first.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: c.isCorrect })) }),
      id: first.id,
    };
    // The check has run (no session, nothing answered); a session opens before the transaction.
    const real = app.prisma;
    let sessionId = '';
    const racing = new Proxy(real, {
      get(target, key) {
        if (key !== '$transaction') return bound(target, key);
        return async (arg: unknown) => {
          const session = await createLiveSession(quiz.id);
          sessionId = session.sessionId;
          return (target.$transaction as (a: unknown) => Promise<unknown>).call(target, arg);
        };
      },
    });
    const decorated = app as unknown as { prisma: typeof real };
    decorated.prisma = racing;
    let res;
    try {
      res = await app.inject({
        method: 'PUT',
        url: `/api/v1/quizzes/${quiz.id}/questions`,
        cookies: cookiesObject(cookies),
        payload: { questions: [keptMcq] }, // drops the numeric question
      });
    } finally {
      decorated.prisma = real;
    }
    expect(res.statusCode).toBe(423);
    expect(res.json().error).toMatchObject({
      code: 'QUIZ_LOCKED',
      details: { reason: 'lock changed during save' },
    });
    // Nothing was written: the numeric question the snapshot names is still there.
    expect(await app.prisma.question.count({ where: { quizId: quiz.id } })).toBe(2);
    expect(sessionId).not.toBe('');
  });

  it('answers:progress reaches the final count, latest answers first', async () => {
    const quiz = await createQuiz('Quiz progression', [mcq()]);
    const { code, s } = await createLiveSession(quiz.id);
    const players = [await joinAs(code, 'Un'), await joinAs(code, 'Deux'), await joinAs(code, 'Trois')];
    await app.sessionManager.startSession(s, false);

    const emitted: Array<{ answered: number; recent: string[] }> = [];
    const presenter = app.io.of('/presenter');
    const spy = vi.spyOn(presenter, 'to').mockReturnValue({
      emit: (event: string, payload: { answered: number; recent: string[] }) => {
        if (event === 'answers:progress') emitted.push(payload);
        return true;
      },
    } as never);
    try {
      const choiceId = s.quizSnapshot.questions[0]!.choices[0]!.id;
      for (const { participant } of players) {
        await app.sessionManager.submitAnswer(s, participant, 0, { choiceId });
        await new Promise((resolve) => setTimeout(resolve, 5)); // distinct elapsedMs
      }
      await new Promise((resolve) => setTimeout(resolve, 300)); // past the throttle window
    } finally {
      spy.mockRestore();
    }
    expect(emitted.at(-1)).toMatchObject({ answered: 3, recent: ['Trois', 'Deux', 'Un'] });
  });

  it('a failed load is not cached', async () => {
    const quiz = await createQuiz('Quiz chargement', [mcq()]);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/quizzes/${quiz.id}/sessions`,
      cookies: cookiesObject(cookies),
      payload: {},
    });
    const { sessionId } = res.json() as { sessionId: string };
    // A standalone manager over a client whose first read fails (Prisma delegates cannot be spied on).
    const findUnique = vi
      .fn()
      .mockRejectedValueOnce(new Error('database busy'))
      .mockImplementation((args: Parameters<typeof app.prisma.liveSession.findUnique>[0]) =>
        app.prisma.liveSession.findUnique(args),
      );
    const manager = new SessionManager(
      app.io,
      { liveSession: { findUnique } } as never,
      () => 'http://localhost',
      app.log,
    );
    await expect(manager.getOrLoad(sessionId)).rejects.toThrow('database busy');
    expect(await manager.getOrLoad(sessionId)).not.toBeNull();
  });

  it('REST end stops the live session', async () => {
    const quiz = await createQuiz('Quiz fin REST', [mcq()]);
    const { sessionId, code, s } = await createLiveSession(quiz.id);
    const { participant } = await joinAs(code, 'Paul');
    await app.sessionManager.startSession(s, false);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${sessionId}/end`,
      cookies: cookiesObject(cookies),
    });
    expect(res.statusCode).toBe(204);
    expect(s.phase).toBe('ENDED');
    const choiceId = s.quizSnapshot.questions[0]!.choices[0]!.id;
    expect(await app.sessionManager.submitAnswer(s, participant, 0, { choiceId })).toMatchObject({
      ok: false,
      code: 'QUESTION_CLOSED',
    });
  });

  it('deleting a session with an open timed question stops its timer', async () => {
    const quiz = await createQuiz('Quiz suppression', [mcq({ timeLimitSec: 30 })]);
    const { sessionId, code, s } = await createLiveSession(quiz.id);
    await joinAs(code, 'Inès');
    await app.sessionManager.startSession(s, false);
    expect(s.timer).not.toBeNull();

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sessions/${sessionId}`,
      cookies: cookiesObject(cookies),
    });
    expect(res.statusCode).toBe(204);
    expect(s.timer).toBeNull();
    expect(s.phase).toBe('ENDED');
    expect(await app.sessionManager.getOrLoad(sessionId)).toBeNull();
  });

  it('a kick in the lobby updates the count on every phone', async () => {
    const quiz = await createQuiz('Quiz lobby exclusion', [mcq()]);
    const { code, s } = await createLiveSession(quiz.id);
    await joinAs(code, 'Alice');
    const { participant } = await joinAs(code, 'Troll');

    const counts: number[] = [];
    const participants = app.io.of('/participant');
    const spy = vi.spyOn(participants, 'to').mockReturnValue({
      emit: (event: string, payload: { count: number }) => {
        if (event === 'lobby:count') counts.push(payload.count);
        return true;
      },
    } as never);
    try {
      expect(await app.sessionManager.kick(s, participant.id)).toEqual({ ok: true });
    } finally {
      spy.mockRestore();
    }
    expect(counts).toEqual([1]);
  });

  it('a join whose transport dropped during the write is not left connected', async () => {
    const quiz = await createQuiz('Quiz fantôme', [mcq()]);
    const { code, s } = await createLiveSession(quiz.id);
    const result = await app.sessionManager.join(fakeSocket('sock-gone', 'closed'), code, 'Fantôme');
    if (!result.ok) throw new Error(result.code);
    expect(result.participant.connected).toBe(false);
    expect(result.participant.socketId).toBeNull();
    expect(s.participants.get(result.participant.id)?.connected).toBe(false);
  });

  it('starting the session is a single write: phase, index and startedAt land together', async () => {
    const quiz = await createQuiz('Quiz départ', [mcq()]);
    const { sessionId, code, s } = await createLiveSession(quiz.id);
    await joinAs(code, 'Léa');
    let updates = 0;
    const liveSession = new Proxy(app.prisma.liveSession, {
      get(delegate, method) {
        if (method !== 'update') return bound(delegate, method);
        return (args: Parameters<typeof delegate.update>[0]) => {
          updates += 1;
          return delegate.update(args);
        };
      },
    });
    const manager = new SessionManager(
      app.io,
      prismaWith({ liveSession }),
      () => 'http://localhost',
      app.log,
    );
    expect(await manager.startSession(s, false)).toEqual({ ok: true });
    expect(updates).toBe(1);
    const row = await app.prisma.liveSession.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row.phase).toBe('QUESTION_OPEN');
    expect(row.currentQuestionIndex).toBe(0);
    expect(row.startedAt).not.toBeNull();
    expect(s.startedAt).toBe(row.startedAt?.getTime());
  });

  it('a close whose write fails leaves the timed question open with its auto-close armed', async () => {
    const quiz = await createQuiz('Quiz fermeture', [mcq({ timeLimitSec: 30 })]);
    const { code, s } = await createLiveSession(quiz.id);
    await joinAs(code, 'Nour');
    await app.sessionManager.startSession(s, false);
    const timer = s.timer;
    expect(timer).not.toBeNull();

    const $transaction = vi.fn().mockRejectedValueOnce(new Error('disk full'));
    const failing = new SessionManager(
      app.io,
      prismaWith({ $transaction }),
      () => 'http://localhost',
      app.log,
    );
    await expect(failing.closeQuestionCommand(s, 0)).rejects.toThrow('disk full');
    expect(s.phase).toBe('QUESTION_OPEN');
    expect(s.timer).toBe(timer);
    // The presenter retries with the same expectedIndex and the round closes normally.
    expect(await app.sessionManager.closeQuestionCommand(s, 0)).toEqual({ ok: true });
    expect(s.phase).toBe('QUESTION_CLOSED');
    expect(s.timer).toBeNull();
  });

  it('a media frozen in a session snapshot cannot be deleted until that session is gone', async () => {
    const boundary = 'vitest-boundary-snapshot';
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/media',
      cookies: cookiesObject(cookies),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="img.gif"\r\n` +
            'Content-Type: image/gif\r\n\r\n',
        ),
        gif,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    expect(upload.statusCode).toBe(201);
    const mediaId = upload.json().media.id as string;
    const quiz = await createQuiz('Quiz image', [mcq({ mediaId })]);
    const { sessionId } = await createLiveSession(quiz.id);

    // The editor swaps the image out: the library no longer references it, the snapshot still does.
    const first = quiz.questions[0]!;
    const swapped = await app.inject({
      method: 'PUT',
      url: `/api/v1/quizzes/${quiz.id}/questions`,
      cookies: cookiesObject(cookies),
      payload: {
        questions: [
          {
            ...mcq({
              choices: first.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: c.isCorrect })),
            }),
            id: first.id,
            mediaId: null,
          },
        ],
      },
    });
    expect(swapped.statusCode).toBe(200);
    const del = () =>
      app.inject({ method: 'DELETE', url: `/api/v1/media/${mediaId}`, cookies: cookiesObject(cookies) });
    const refused = await del();
    expect(refused.statusCode).toBe(409);
    expect(refused.json().error.code).toBe('MEDIA_REFERENCED');

    const gone = await app.inject({
      method: 'DELETE',
      url: `/api/v1/sessions/${sessionId}`,
      cookies: cookiesObject(cookies),
    });
    expect(gone.statusCode).toBe(204);
    expect((await del()).statusCode).toBe(204);
  });

  const loadedIds = () => (app.sessionManager as unknown as { sessions: Map<string, unknown> }).sessions;
  const forget = (id: string) =>
    (app.sessionManager as unknown as { forget: (id: string) => void }).forget(id);

  it('a resume snapshot keeps score and rank off the open question until it closes (no answer oracle)', async () => {
    const quiz = await createQuiz('Quiz oracle', [mcq(), mcq()]);
    const { code, s } = await createLiveSession(quiz.id);
    const lea = await joinAs(code, 'Léa');
    const tom = await joinAs(code, 'Tom');
    const choice = (i: number, correct: boolean) =>
      s.quizSnapshot.questions[i]!.choices.find((c) => c.isCorrect === correct)!.id;
    await app.sessionManager.startSession(s, false);
    // Q1: Léa right, Tom wrong → Léa 100, Tom 0.
    await app.sessionManager.submitAnswer(s, lea.participant, 0, { choiceId: choice(0, true) });
    await app.sessionManager.submitAnswer(s, tom.participant, 0, { choiceId: choice(0, false) });
    await app.sessionManager.closeQuestionCommand(s, 0);
    await app.sessionManager.nextQuestion(s, 0);

    // Q2 open: Tom right, Léa wrong. What each phone reads on resume must not move.
    await app.sessionManager.submitAnswer(s, tom.participant, 1, { choiceId: choice(1, true) });
    await app.sessionManager.submitAnswer(s, lea.participant, 1, { choiceId: choice(1, false) });
    const resumeSnapshot = async (token: string, socketId: string) => {
      const resumed = await app.sessionManager.resumeByToken(fakeSocket(socketId), token);
      if (!resumed.ok) throw new Error(resumed.code);
      return app.sessionManager.participantSnapshot(resumed.s, resumed.participant);
    };
    const tomOpen = await resumeSnapshot(tom.token, 'sock-tom-2');
    const leaOpen = await resumeSnapshot(lea.token, 'sock-lea-2');
    expect(tomOpen.phase).toBe('QUESTION_OPEN');
    expect(tomOpen.you).toMatchObject({ score: 0, rank: 2 });
    expect(leaOpen.you).toMatchObject({ score: 100, rank: 1 });
    expect(tomOpen.question?.alreadyAnswered).toBe(true);
    // The presenter keeps the live scores.
    const live = (await app.sessionManager.presenterSnapshot(s)).participants;
    expect(live.find((p) => p.id === tom.participant.id)?.score).toBe(100);

    // After question:closed, the new standings show.
    await app.sessionManager.closeQuestionCommand(s, 1);
    const tomClosed = await resumeSnapshot(tom.token, 'sock-tom-3');
    expect(tomClosed.you.score).toBe(100);
    expect(tomClosed.roundResult).toMatchObject({ totalScore: 100, pointsAwarded: 100 });
  });

  it('an answer queued behind a close and a reopen is refused, not scored against the new opening', async () => {
    const quiz = await createQuiz('Quiz file d’attente', [mcq({ timeLimitSec: 30, speedBonusMax: 500 })]);
    const { code, s } = await createLiveSession(quiz.id);
    const { participant } = await joinAs(code, 'Rapide');
    const late = await joinAs(code, 'Tardif');
    await app.sessionManager.startSession(s, false);
    const right = s.quizSnapshot.questions[0]!.choices.find((c) => c.isCorrect)!.id;

    // Sent to the first opening, it reaches the lock only after the close and the reopen.
    const close = app.sessionManager.closeQuestionCommand(s, 0);
    const reopen = app.sessionManager.reopenQuestion(s, 0);
    const queued = app.sessionManager.submitAnswer(s, participant, 0, { choiceId: right });
    expect(await close).toEqual({ ok: true });
    expect(await reopen).toEqual({ ok: true });
    expect(await queued).toMatchObject({ ok: false, code: 'QUESTION_CLOSED' });
    expect(participant.answers.has(0)).toBe(false);

    // Sent while the result was showing, queued behind a reopen: refused as well.
    await app.sessionManager.closeQuestionCommand(s, 0);
    const reopened = app.sessionManager.reopenQuestion(s, 0);
    const early = app.sessionManager.submitAnswer(s, late.participant, 0, { choiceId: right });
    expect(await reopened).toEqual({ ok: true });
    expect(await early).toMatchObject({ ok: false, code: 'QUESTION_CLOSED' });

    // An answer sent to the current opening is still accepted.
    expect(await app.sessionManager.submitAnswer(s, participant, 0, { choiceId: right })).toMatchObject({
      ok: true,
    });
    await app.sessionManager.endSession(s); // stops the auto-close timer
  });

  it('joining an ENDED session is refused without loading it back into memory', async () => {
    const quiz = await createQuiz('Quiz terminé', [mcq()]);
    const { sessionId, code, s } = await createLiveSession(quiz.id);
    await app.sessionManager.endSession(s);
    forget(sessionId);
    const result = await app.sessionManager.join(fakeSocket('sock-late'), code, 'Retard');
    expect(result).toMatchObject({ ok: false, code: 'SESSION_CLOSED_TO_JOIN' });
    expect(loadedIds().has(sessionId)).toBe(false);
  });

  it('a session deleted while not loaded cannot be rebuilt in memory by a concurrent load', async () => {
    const quiz = await createQuiz('Quiz suppression concurrente', [mcq()]);
    const { sessionId, s } = await createLiveSession(quiz.id);
    await app.sessionManager.endSession(s);
    forget(sessionId);
    // A delete held open long enough for a load to read the row it is about to remove.
    let releaseDelete = () => {};
    const gate = new Promise<void>((resolve) => (releaseDelete = resolve));
    const liveSession = new Proxy(app.prisma.liveSession, {
      get(delegate, method) {
        if (method !== 'delete') return bound(delegate, method);
        return async (args: Parameters<typeof delegate.delete>[0]) => {
          await gate;
          return delegate.delete(args);
        };
      },
    });
    const manager = new SessionManager(
      app.io,
      prismaWith({ liveSession }),
      () => 'http://localhost',
      app.log,
    );
    const deleted = manager.deleteSession(sessionId);
    await new Promise((resolve) => setImmediate(resolve)); // the delete now waits on the gate
    const loaded = await manager.getOrLoad(sessionId);
    releaseDelete();
    await deleted;
    expect(loaded).toBeNull();
    expect((manager as unknown as { sessions: Map<string, unknown> }).sessions.has(sessionId)).toBe(false);
  });

  describe('socket handshakes', () => {
    let base = '';
    const opened: ClientSocket[] = [];

    beforeAll(async () => {
      await app.listen({ port: 0, host: '127.0.0.1' });
      const address = app.server.address();
      if (!address || typeof address === 'string') throw new Error('no port');
      base = `http://127.0.0.1:${address.port}`;
    });

    afterAll(() => {
      for (const socket of opened) socket.close();
    });

    /** Resolves 'connected' or the refusal: `data.code` for a middleware one, the message otherwise. */
    const handshake = (
      namespace: string,
      opts: { origin?: string; transport?: 'websocket' | 'polling'; auth?: object; cookie?: string } = {},
    ) =>
      new Promise<string>((resolve) => {
        const headers: Record<string, string> = {};
        if (opts.origin) headers.origin = opts.origin;
        if (opts.cookie) headers.cookie = opts.cookie;
        const socket = ioClient(`${base}${namespace}`, {
          transports: [opts.transport ?? 'websocket'],
          extraHeaders: headers,
          auth: opts.auth ?? {},
          reconnection: false,
          forceNew: true,
        });
        opened.push(socket);
        socket.on('connect', () => resolve('connected'));
        socket.on('connect_error', (err: Error & { data?: { code?: string } }) =>
          resolve(err.data?.code ?? err.message),
        );
      });

    it('refuses a browser handshake from another origin, on both transports', async () => {
      const quiz = await createQuiz('Quiz origine', [mcq()]);
      const { sessionId } = await createLiveSession(quiz.id);
      const presenter = { auth: { sessionId }, cookie: cookies };
      // PUBLIC_URL defaults to http://localhost:5173 (the Vite dev server, which forwards Origin as is).
      for (const transport of ['websocket', 'polling'] as const) {
        expect(await handshake('/participant', { origin: 'http://localhost:5173', transport })).toBe(
          'connected',
        );
        expect(await handshake('/participant', { origin: 'http://127.0.0.1:5173', transport })).toBe(
          'connected',
        );
        expect(await handshake('/participant', { transport })).toBe('connected'); // no Origin: not a browser
        expect(
          await handshake('/presenter', { ...presenter, origin: 'http://localhost:5173', transport }),
        ).toBe('connected');
        for (const origin of [
          'http://localhost:8081',
          'https://localhost:5173',
          'http://evil.example',
          'null',
        ]) {
          // Refused by the engine before any namespace middleware: no refusal code, a transport error.
          const participant = await handshake('/participant', { origin, transport });
          const stage = await handshake('/presenter', { ...presenter, origin, transport });
          expect([participant, stage]).toEqual([
            expect.stringMatching(/error/i),
            expect.stringMatching(/error/i),
          ]);
        }
      }
    });

    it('refuses a malformed resume token', async () => {
      expect(await handshake('/participant', { auth: { token: { $ne: '' } } })).toBe('TOKEN_INVALID');
      expect(await handshake('/participant', { auth: { token: 'x'.repeat(4096) } })).toBe('TOKEN_INVALID');
    });

    it('checks the presenter owns the session before loading it', async () => {
      const quiz = await createQuiz('Quiz présentateur', [mcq()]);
      const { sessionId } = await createLiveSession(quiz.id);
      forget(sessionId);
      const other = 'other-presenter@example.fr';
      await app.prisma.admin.upsert({
        where: { email: other },
        update: {},
        create: { email: other, displayName: 'Autre', passwordHash: await hash(TEST_PASSWORD) },
      });
      try {
        const login = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: other, password: TEST_PASSWORD },
        });
        const otherCookie = setCookieOf(login);
        expect(await handshake('/presenter', { auth: { sessionId }, cookie: otherCookie })).toBe('FORBIDDEN');
        expect(loadedIds().has(sessionId)).toBe(false);
        expect(await handshake('/presenter', { auth: { sessionId: 'nope' }, cookie: cookies })).toBe(
          'SESSION_NOT_FOUND',
        );
        expect(await handshake('/presenter', { auth: { sessionId }, cookie: cookies })).toBe('connected');
        expect(loadedIds().has(sessionId)).toBe(true);
      } finally {
        await app.prisma.admin.delete({ where: { email: other } }).catch(() => undefined);
      }
    });

    it('refuses a presenter handshake with a logged-out access token', async () => {
      const quiz = await createQuiz('Quiz déconnexion', [mcq()]);
      const { sessionId } = await createLiveSession(quiz.id);
      const login = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: '203.0.113.77',
        payload: { email: TEST_EMAIL, password: TEST_PASSWORD },
      });
      const session = setCookieOf(login);
      expect(await handshake('/presenter', { auth: { sessionId }, cookie: session })).toBe('connected');
      const logout = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: cookiesObject(session),
      });
      expect(logout.statusCode).toBe(204);
      expect(await handshake('/presenter', { auth: { sessionId }, cookie: session })).toBe('UNAUTHORIZED');
    });
  });
});

function cookiesObject(raw: string): Record<string, string> {
  return raw.split(/(?<=;)\s*(?=[^=]+?=)/).reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.split(';')[0]!.trim();
    return acc;
  }, {});
}
