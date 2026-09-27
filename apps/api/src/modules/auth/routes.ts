// Auth routes (§5.1): login, refresh, logout, me, admin management, change-password.

import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import {
  ADMIN_PASSWORD_RESETS_PER_MINUTE,
  AdminCreateInput,
  AdminPasswordResetInput,
  AdminPatchInput,
  CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE,
  ChangePasswordInput,
  LOGIN_ATTEMPTS_PER_MINUTE,
  LoginInput,
  toAccountRole,
  wouldRemoveLastAdmin,
  type AdminDTO,
} from '@quiz/shared';

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  apiError,
  sha256,
  validationError,
} from '../../lib/api.js';
import { hashPassword, verifyPassword, verifyThenHash } from '../../lib/password.js';
import { LoginThrottleTracker, globalAddressLimit, perAdminLimit } from '../../lib/rate-limit.js';
import { nextCredentialVersion } from '../../plugins/auth.js';
import { REQUEST_TX_OPTIONS } from '../../plugins/prisma.js';

function toAdminDTO(a: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}): AdminDTO {
  return {
    id: a.id,
    email: a.email,
    displayName: a.displayName,
    role: toAccountRole(a.role),
    isActive: a.isActive,
    createdAt: a.createdAt.getTime(),
  };
}

// Whether `adminId` is an active ADMIN right now, read on `tx`: account-management writes call it
// inside their transaction, after requireAdmin, so a demotion or a deactivation committed while the
// request was in flight is honoured before anything is written.
async function isActiveAdmin(tx: Prisma.TransactionClient, adminId: string | null): Promise<boolean> {
  if (adminId === null) return false;
  const actor = await tx.admin.findUnique({ where: { id: adminId }, select: { role: true, isActive: true } });
  return actor !== null && actor.isActive && toAccountRole(actor.role) === 'ADMIN';
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Real Argon2id hash verified when the email is unknown, so an unknown email costs the same
  // time and yields the same 401 as a wrong password (no user enumeration). A hand-written
  // hash string would make argon2 throw and turn the unknown-email branch into a 500.
  const dummyHash = await hashPassword(`dummy-${Date.now()}`);
  // Per-account progressive delay (see LOGIN_FREE_FAILURES), one store per app instance.
  const loginThrottle = new LoginThrottleTracker();

  // --- POST /api/v1/auth/login ---------------------------------------------
  // Two limits: per client address (the route limit, an IPv6 client per /64) and per account
  // (loginThrottle), so rotating through many addresses buys no faster guessing on one account.
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: LOGIN_ATTEMPTS_PER_MINUTE, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = LoginInput.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send(apiError('INVALID_CREDENTIALS'));
      const { password } = parsed.data;
      const email = parsed.data.email.toLowerCase();

      // Inside the account's delay (or with one of its checks in flight once delayed): refused before
      // any lookup or hashing, the same way for a known and an unknown email (both are tracked
      // alike), so the 429 reveals nothing about the account. Claimed synchronously, before the first
      // await: parallel attempts cannot all pass while their hashes run.
      const claim = loginThrottle.claim(email);
      if (!claim.ok) {
        return reply.status(429).header('retry-after', claim.retryAfter).send(apiError('RATE_LIMITED'));
      }
      const { attempt } = claim;

      const { admin, ok } = await (async () => {
        const found = await app.prisma.admin.findUnique({ where: { email } });
        // Constant-ish time: verify against the dummy hash when the admin is unknown.
        return { admin: found, ok: await verifyPassword(found?.passwordHash ?? dummyHash, password) };
      })().catch((err: unknown) => {
        // A server fault (answered 500) is no wrong guess, and neither is a refusal of the saturated
        // Argon2 limiter (PasswordHashingBusyError, answered 429 RATE_LIMITED by the error handler —
        // for a known and an unknown email alike, the dummy verify queuing the same way): give the
        // attempt back, to the run it was counted in only.
        loginThrottle.release(attempt);
        throw err;
      });
      if (!admin || !ok || !admin.isActive) {
        loginThrottle.fail(attempt);
        return reply.status(401).send(apiError('INVALID_CREDENTIALS'));
      }
      loginThrottle.reset(email);

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
    if (!check.ok) {
      // A refusal mints nothing either way; what it may do is clear the cookies, and the server
      // cannot see the browser's jar, only the cookie this request carried. A request sent before a
      // change-password (or a login in another tab) answered can land after it, and its Set-Cookie
      // clearing would wipe the fresh cookies that response just set, signing the admin out. So a
      // `dead` refusal leaves the cookies alone: replaying a dead token is inert (refused again, no
      // side effect), and the client ends on the login page all the same — it tries one refresh per
      // 401, and every protected request answers 401 with or without the dead cookies.
      // A `reuse` refusal still clears them: that replay revokes every live token of the admin, and a
      // browser left holding the token would repeat it on each refresh (the presenter view refreshes
      // every 10 min), signing the admin out of each new device session in turn. It is not always a
      // theft: a rotation whose response was lost leaves the rotated token in this very jar, and its
      // next refresh is reuse all the same — once, since the clear takes the token out of the jar.
      if (check.reason === 'reuse') app.clearAuthCookies(reply);
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

  // Account management is ADMIN-only. requireAdmin reads the role authenticate loaded on this very
  // request, so a demoted account loses these routes from its next request, with the same access
  // token; the writes (POST, PATCH, password reset) check it once more inside their transaction
  // (isActiveAdmin), so a request already in flight when the demotion commits writes nothing either.
  // A fresh array per route: @fastify/rate-limit pushes a route-level limiter onto the route's own
  // preHandler array, so one shared array would carry that limit onto every other account route.
  const adminOnly = () => [app.authenticate, app.requireAdmin];

  // --- GET /api/v1/admins ---------------------------------------------------
  app.get('/admins', { preHandler: adminOnly() }, async () => {
    const admins = await app.prisma.admin.findMany({ orderBy: { createdAt: 'asc' } });
    return { admins: admins.map(toAdminDTO) };
  });

  // --- POST /api/v1/admins --------------------------------------------------
  app.post('/admins', { preHandler: adminOnly() }, async (req, reply) => {
    const parsed = AdminCreateInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error));
    }
    const email = parsed.data.email.toLowerCase();
    const existing = await app.prisma.admin.findUnique({ where: { email } });
    if (existing) return reply.status(409).send(apiError('VALIDATION'));
    const passwordHash = await hashPassword(parsed.data.password);
    // The caller's role and the email are checked again next to the write: the argon2 run above
    // leaves room for a demotion committed since requireAdmin (a demoted account must not mint an
    // ADMIN), and for a concurrent creation of the same email, which would otherwise surface as a
    // unique-constraint 500 instead of this 409.
    const admin = await app.prisma.$transaction(async (tx) => {
      if (!(await isActiveAdmin(tx, req.adminId))) return 'FORBIDDEN' as const;
      if (await tx.admin.findUnique({ where: { email }, select: { id: true } })) return 'EXISTS' as const;
      return tx.admin.create({
        data: {
          email,
          displayName: parsed.data.displayName,
          role: parsed.data.role,
          passwordHash,
        },
      });
    }, REQUEST_TX_OPTIONS);
    if (admin === 'FORBIDDEN') return reply.status(403).send(apiError('FORBIDDEN'));
    if (admin === 'EXISTS') return reply.status(409).send(apiError('VALIDATION'));
    return reply.status(201).send({ admin: toAdminDTO(admin) });
  });

  // --- PATCH /api/v1/admins/:id --------------------------------------------
  app.patch<{ Params: { id: string } }>('/admins/:id', { preHandler: adminOnly() }, async (req, reply) => {
    const parsed = AdminPatchInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error));
    }
    const { displayName, role, isActive } = parsed.data;
    const deactivating = isActive === false;
    // Self-deactivation is refused, so the credential bump below never hits the caller's own session.
    // Self-demotion is allowed, as long as another active ADMIN remains (checked below).
    if (deactivating && req.params.id === req.adminId) {
      return reply.status(409).send(apiError('CANNOT_DEACTIVATE_SELF'));
    }
    const data = {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    // One transaction: re-check the caller is still an active ADMIN, read the target, count the
    // active ADMINs, refuse LAST_ADMIN if none would remain, then write. Interactive transactions run
    // one at a time on the single SQLite connection, so two ADMINs demoting each other at once cannot
    // both read a count of two (the second sees the first one's write and is refused), and a caller
    // demoted while its request was in flight cannot undo that demotion (FORBIDDEN).
    // A deactivation also bumps the credential version in that transaction: every access JWT and
    // refresh token issued before it is refused for good, not only while `isActive` is false — a
    // copied cookie does not come back to life on reactivation, and a login racing this update mints
    // tokens under the old version. The version is read in the transaction and moved strictly past
    // it, so a password change committed in the same millisecond cannot end up sharing it.
    // Reactivation does not bump: nothing is live to revoke. A role change alone revokes nothing
    // either: authenticate reads the role on every request, so it applies from the next one.
    const admin = await app.prisma.$transaction(async (tx) => {
      if (!(await isActiveAdmin(tx, req.adminId))) return 'FORBIDDEN' as const;
      const current = await tx.admin.findUnique({
        where: { id: req.params.id },
        select: { role: true, isActive: true, passwordChangedAt: true },
      });
      if (!current) return 'NOT_FOUND' as const;
      if (deactivating || role !== undefined) {
        const activeAdminCount = await tx.admin.count({ where: { isActive: true, role: 'ADMIN' } });
        const before = { role: toAccountRole(current.role), isActive: current.isActive };
        if (wouldRemoveLastAdmin(before, { role, isActive }, activeAdminCount)) {
          return 'LAST_ADMIN' as const;
        }
      }
      return tx.admin.update({
        where: { id: req.params.id },
        data: deactivating
          ? { ...data, passwordChangedAt: nextCredentialVersion(current.passwordChangedAt) }
          : data,
      });
    }, REQUEST_TX_OPTIONS);
    // Refused inside the transaction: nothing was written.
    if (admin === 'FORBIDDEN') return reply.status(403).send(apiError('FORBIDDEN'));
    if (admin === 'NOT_FOUND') return reply.status(404).send(apiError('NOT_FOUND'));
    if (admin === 'LAST_ADMIN') return reply.status(409).send(apiError('LAST_ADMIN'));
    // A deactivation ends the account's sessions, whoever holds them. There is no password field
    // here (AdminPatchInput is strict): an ADMIN resets another account's password through
    // POST /admins/:id/password, and an account changes its own through /auth/change-password.
    if (deactivating) {
      await app.revokeAdminSessions(admin.id);
    }
    return { admin: toAdminDTO(admin) };
  });

  // --- POST /api/v1/admins/:id/password -------------------------------------
  // An ADMIN sets another account's password, whatever its role or status (an inactive account stays
  // inactive), without knowing the current one. Its own password goes through /auth/change-password,
  // which asks for the current one, so this route never lets a session replace its own account's
  // password without it. That is no step-up: an ADMIN session can already create a second ADMIN and
  // reset from there, as it can do anything else an ADMIN can.
  // Limits as on change-password (perAdminLimit, after requireAdmin: a USER is refused 403 before
  // touching the store).
  app.post<{ Params: { id: string } }>(
    '/admins/:id/password',
    {
      onRequest: globalAddressLimit(app),
      preHandler: adminOnly(),
      config: { rateLimit: perAdminLimit('admin-reset', ADMIN_PASSWORD_RESETS_PER_MINUTE) },
    },
    async (req, reply) => {
      const parsed = AdminPasswordResetInput.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send(validationError(parsed.error));
      }
      const targetId = req.params.id;
      if (targetId === req.adminId) {
        return reply.status(409).send(apiError('CANNOT_RESET_OWN_PASSWORD'));
      }
      const exists = await app.prisma.admin.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!exists) return reply.status(404).send(apiError('NOT_FOUND'));
      // Hashed outside the transaction, through the Argon2 limiter (a saturated one answers 429 before
      // anything is written): the single SQLite connection is not held during the hash.
      const passwordHash = await hashPassword(parsed.data.password);
      // One transaction: re-check the caller is still an active ADMIN (a demotion or a deactivation
      // committed during the hash wins), re-read the target, then write the hash with a credential
      // version moved strictly past the one read here, so every access JWT and refresh token issued
      // before is refused — and still after a later reactivation.
      const result = await app.prisma.$transaction(async (tx) => {
        if (!(await isActiveAdmin(tx, req.adminId))) return 'FORBIDDEN' as const;
        const current = await tx.admin.findUnique({
          where: { id: targetId },
          select: { email: true, passwordChangedAt: true },
        });
        if (!current) return 'NOT_FOUND' as const;
        await tx.admin.update({
          where: { id: targetId },
          data: { passwordHash, passwordChangedAt: nextCredentialVersion(current.passwordChangedAt) },
        });
        return { email: current.email };
      }, REQUEST_TX_OPTIONS);
      if (result === 'FORBIDDEN') return reply.status(403).send(apiError('FORBIDDEN'));
      if (result === 'NOT_FOUND') return reply.status(404).send(apiError('NOT_FOUND'));
      // The bump is committed: end every session of the target (refresh rows, presenter sockets).
      await app.revokeAdminSessions(targetId);
      // The account starts afresh at login, as after a successful one: failures typed against the old
      // password must not delay the first sign-in with the new one.
      loginThrottle.reset(result.email.toLowerCase());
      return reply.status(204).send();
    },
  );

  // --- POST /api/v1/auth/change-password ------------------------------------
  // Limited per admin (perAdminLimit, after authenticate) and per address: the route-level config
  // replaces the global per-address limiter here, so the onRequest hook draws on the global bucket
  // explicitly, and requests refused by authenticate (no, forged or revoked token) stay capped per
  // address like on any other route.
  app.post(
    '/auth/change-password',
    {
      onRequest: globalAddressLimit(app),
      preHandler: app.authenticate,
      config: { rateLimit: perAdminLimit('admin', CHANGE_PASSWORD_ATTEMPTS_PER_MINUTE) },
    },
    async (req, reply) => {
      const parsed = ChangePasswordInput.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send(validationError(parsed.error));
      }
      const admin = await app.prisma.admin.findUnique({ where: { id: req.adminId! } });
      if (!admin) return reply.status(404).send(apiError('NOT_FOUND'));
      // Verify and hash hold one Argon2 slot together: a saturated limiter (PasswordHashingBusyError,
      // 429 RATE_LIMITED) refuses the request before the verify, whatever the current password, so a
      // 429 never tells a right guess from a wrong one — and it comes before the update below, so a
      // refused request changes nothing.
      const passwordHash = await verifyThenHash(
        admin.passwordHash,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
      if (passwordHash === null) return reply.status(401).send(apiError('INVALID_CREDENTIALS'));
      // passwordChangedAt is the credential version every access JWT carries: bumping it refuses all
      // the JWTs signed before, this request's own included. Conditional on the version and status read
      // above: a deactivation (or another password change) landing during the hashing already bumped
      // the version, and this request must not mint tokens under a newer one — they would come back
      // to life on reactivation.
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
