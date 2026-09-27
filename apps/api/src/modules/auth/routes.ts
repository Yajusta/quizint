// Auth routes (§5.1): login, refresh, logout, me, admin management, change-password.

import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  AdminCreateInput,
  AdminPatchInput,
  CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE,
  ChangePasswordInput,
  LOGIN_ATTEMPTS_PER_MINUTE,
  LoginInput,
} from '@quiz/shared';

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  apiError,
  sha256,
  validationError,
} from '../../lib/api.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { LoginFailureTracker } from '../../lib/rate-limit.js';
import { nextCredentialVersion } from '../../plugins/auth.js';

function toAdminDTO(a: {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    isActive: a.isActive,
    createdAt: a.createdAt.getTime(),
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Real Argon2id hash verified when the email is unknown, so an unknown email costs the same
  // time and yields the same 401 as a wrong password (no user enumeration). A hand-written
  // hash string would make argon2 throw and turn the unknown-email branch into a 500.
  const dummyHash = await hashPassword(`dummy-${Date.now()}`);
  // Per-account budget (LOGIN_FAILURES_PER_ACCOUNT per LOGIN_FAILURE_WINDOW_MS), one per app instance.
  const loginFailures = new LoginFailureTracker();

  // --- POST /api/v1/auth/login ---------------------------------------------
  // Two budgets: per client address (the route limit, an IPv6 client per /64) and per account
  // (loginFailures), so rotating through many addresses buys no more guesses on one account.
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: LOGIN_ATTEMPTS_PER_MINUTE, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = LoginInput.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send(apiError('INVALID_CREDENTIALS'));
      const { password } = parsed.data;
      const email = parsed.data.email.toLowerCase();

      // Spent budget: refused before any lookup or hashing, the same way for a known and an unknown
      // email (both are counted alike below), so the 429 reveals nothing about the account.
      const retryAfter = loginFailures.throttledFor(email);
      if (retryAfter !== null) {
        return reply.status(429).header('retry-after', retryAfter).send(apiError('RATE_LIMITED'));
      }
      // Counted up front, cleared on success: parallel attempts cannot all pass the check above
      // while their hashes run.
      loginFailures.countFailure(email);

      const { admin, ok } = await (async () => {
        const found = await app.prisma.admin.findUnique({ where: { email } });
        // Constant-ish time: verify against the dummy hash when the admin is unknown.
        return { admin: found, ok: await verifyPassword(found?.passwordHash ?? dummyHash, password) };
      })().catch((err: unknown) => {
        // A server fault (answered 500) is no wrong guess: give the attempt back.
        loginFailures.uncountFailure(email);
        throw err;
      });
      if (!admin || !ok || !admin.isActive) {
        return reply.status(401).send(apiError('INVALID_CREDENTIALS'));
      }
      loginFailures.reset(email);

      app.issueAccessToken(reply, admin);
      await app.issueRefreshToken(reply, admin.id, admin.passwordChangedAt);
      return { admin: toAdminDTO(admin) };
    },
  );

  // --- POST /api/v1/auth/refresh -------------------------------------------
  app.post('/auth/refresh', async (req, reply) => {
    // verifyRefreshToken also refuses an inactive admin and a family opened under an older credential
    // version, i.e. before a password change or a deactivation (a rotation racing revokeAdminSessions
    // may have minted a live successor): such a row gets nothing, not even the access token of the
    // grace path below.
    const check = await app.verifyRefreshToken(req);
    if (!check) {
      app.clearAuthCookies(reply);
      return reply.status(401).send(apiError('UNAUTHORIZED'));
    }
    const { admin } = check;
    app.issueAccessToken(reply, admin);
    // A replay inside the rotation grace gets an access token only (issueRefreshToken returns null):
    // the refresh token minted by the first rotation is already in this browser's cookie jar, and a
    // stolen copy must not mint a second, independent one (see REFRESH_ROTATION_GRACE_MS). The
    // successor inherits the row's credential version: verifyRefreshToken only accepts a row whose
    // version equals the admin's passwordChangedAt as read in that same check, so the two are one
    // value (a password change landing after that read is caught by the version check next time).
    await app.issueRefreshToken(reply, admin.id, admin.passwordChangedAt, check.id);
    return { admin: toAdminDTO(admin) };
  });

  // --- POST /api/v1/auth/logout --------------------------------------------
  app.post('/auth/logout', async (req, reply) => {
    // The access JWT dies with the logout too, not 15 min later: a copy of the cookie is useless.
    const accessToken = req.cookies[ACCESS_TOKEN_COOKIE];
    if (accessToken) app.revokeAccessToken(accessToken);
    const token = req.cookies[REFRESH_TOKEN_COOKIE];
    if (token) {
      // Hard revocation: expired too, so the rotation grace window cannot resurrect it.
      const at = new Date();
      await app.prisma.refreshToken.updateMany({
        where: { tokenHash: sha256(token) },
        data: { revokedAt: at, expiresAt: at },
      });
    }
    app.clearAuthCookies(reply);
    return reply.status(204).send();
  });

  // --- GET /api/v1/auth/me ---------------------------------------------------
  app.get('/auth/me', { preHandler: app.authenticate }, async (req, reply) => {
    const admin = await app.prisma.admin.findUnique({ where: { id: req.adminId! } });
    if (!admin) return reply.status(404).send(apiError('NOT_FOUND'));
    return { admin: toAdminDTO(admin) };
  });

  // --- GET /api/v1/admins ---------------------------------------------------
  app.get('/admins', { preHandler: app.authenticate }, async () => {
    const admins = await app.prisma.admin.findMany({ orderBy: { createdAt: 'asc' } });
    return { admins: admins.map(toAdminDTO) };
  });

  // --- POST /api/v1/admins --------------------------------------------------
  app.post('/admins', { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = AdminCreateInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error));
    }
    const existing = await app.prisma.admin.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (existing) return reply.status(409).send(apiError('VALIDATION'));
    const admin = await app.prisma.admin.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        displayName: parsed.data.displayName,
        passwordHash: await hashPassword(parsed.data.password),
      },
    });
    return reply.status(201).send({ admin: toAdminDTO(admin) });
  });

  // --- PATCH /api/v1/admins/:id --------------------------------------------
  app.patch<{ Params: { id: string } }>(
    '/admins/:id',
    { preHandler: app.authenticate },
    async (req, reply) => {
      const parsed = AdminPatchInput.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send(validationError(parsed.error));
      }
      const target = await app.prisma.admin.findUnique({ where: { id: req.params.id } });
      if (!target) return reply.status(404).send(apiError('NOT_FOUND'));
      const deactivating = parsed.data.isActive === false;
      // Self-deactivation is refused, so the credential bump below never hits the caller's own session.
      if (deactivating && target.id === req.adminId) {
        return reply.status(409).send(apiError('CANNOT_DEACTIVATE_SELF'));
      }
      // A deactivation bumps the credential version in the same transaction: every access JWT and
      // refresh token issued before it is refused for good, not only while `isActive` is false — a
      // copied cookie does not come back to life on reactivation, and a login racing this update mints
      // tokens under the old version. The version is read in the transaction and moved strictly past
      // it, so a password change committed in the same millisecond cannot end up sharing it.
      // Reactivation does not bump: nothing is live to revoke.
      const admin = await app.prisma.$transaction(async (tx) => {
        const current = deactivating
          ? await tx.admin.findUniqueOrThrow({
              where: { id: req.params.id },
              select: { passwordChangedAt: true },
            })
          : null;
        return tx.admin.update({
          where: { id: req.params.id },
          data: {
            ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
            ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
            ...(current ? { passwordChangedAt: nextCredentialVersion(current.passwordChangedAt) } : {}),
          },
        });
      });
      // A deactivation ends the account's sessions, whoever holds them. There is no password field
      // here (AdminPatchInput is strict): nobody resets a colleague's password.
      if (deactivating) {
        await app.revokeAdminSessions(admin.id);
      }
      return { admin: toAdminDTO(admin) };
    },
  );

  // --- POST /api/v1/auth/change-password ------------------------------------
  // The limit runs as a preHandler, after authenticate (appended to the route's preHandler array),
  // not on onRequest: the key is the admin that authenticate verified in full, never an unverified
  // claim. Keyed on the admin, a stolen cookie gets the same budget from any IP. A request without a
  // valid token stops at authenticate's 401 and never touches the store: it cannot evict an admin's
  // bucket from the LRU, and an expired token still gets the 401 the client refreshes on, not a 429.
  app.post(
    '/auth/change-password',
    {
      preHandler: app.authenticate,
      config: {
        rateLimit: {
          hook: 'preHandler',
          max: CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) => `admin:${req.adminId}`,
        },
      },
    },
    async (req, reply) => {
      const parsed = ChangePasswordInput.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send(validationError(parsed.error));
      }
      const admin = await app.prisma.admin.findUnique({ where: { id: req.adminId! } });
      if (!admin) return reply.status(404).send(apiError('NOT_FOUND'));
      const ok = await verifyPassword(admin.passwordHash, parsed.data.currentPassword);
      if (!ok) return reply.status(401).send(apiError('INVALID_CREDENTIALS'));
      // passwordChangedAt is the credential version every access JWT carries: bumping it refuses all
      // the JWTs signed before, this request's own included. Conditional on the version and status read
      // above: a deactivation (or another password change) landing during the hashing already bumped
      // the version, and this request must not mint tokens under a newer one — they would come back
      // to life on reactivation.
      const passwordHash = await hashPassword(parsed.data.newPassword);
      const passwordChangedAt = nextCredentialVersion(admin.passwordChangedAt);
      const { count } = await app.prisma.admin.updateMany({
        where: { id: admin.id, isActive: true, passwordChangedAt: admin.passwordChangedAt },
        data: { passwordHash, passwordChangedAt },
      });
      if (count === 0) {
        // Lost the race. Answered like a wrong current password — which it now is after a concurrent
        // change (a double submit) — so the client neither refreshes nor retries; the cookies are left
        // alone, as clearing them could land after, and wipe, the ones the winning request just set.
        // After a deactivation the next request gets its 401 from authenticate anyway.
        return reply.status(401).send(apiError('INVALID_CREDENTIALS'));
      }
      const updated = { ...admin, passwordHash, passwordChangedAt };
      // Every other session of this account ends (a stolen refresh cookie or access JWT included);
      // this browser gets fresh cookies so the admin who just changed their password stays signed in.
      await app.revokeAdminSessions(admin.id);
      app.issueAccessToken(reply, updated);
      await app.issueRefreshToken(reply, admin.id, updated.passwordChangedAt);
      return reply.status(204).send();
    },
  );
}
