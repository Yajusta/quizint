// Auth routes (§5.1): login, refresh, logout, me, admin management, change-password.

import type { FastifyInstance } from 'fastify';

import { AdminCreateInput, AdminPatchInput, ChangePasswordInput, LoginInput } from '@quiz/shared';

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  apiError,
  sha256,
  validationError,
} from '../../lib/api.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';

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

  // --- POST /api/v1/auth/login ---------------------------------------------
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const parsed = LoginInput.safeParse(req.body);
      if (!parsed.success) return reply.status(400).send(apiError('INVALID_CREDENTIALS'));
      const { email, password } = parsed.data;

      const admin = await app.prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
      // Constant-ish time: verify against the dummy hash when the admin is unknown.
      const ok = await verifyPassword(admin?.passwordHash ?? dummyHash, password);
      if (!admin || !ok || !admin.isActive) {
        return reply.status(401).send(apiError('INVALID_CREDENTIALS'));
      }

      app.issueAccessToken(reply, admin);
      await app.issueRefreshToken(reply, admin.id, admin.passwordChangedAt);
      return { admin: toAdminDTO(admin) };
    },
  );

  // --- POST /api/v1/auth/refresh -------------------------------------------
  app.post('/auth/refresh', async (req, reply) => {
    // verifyRefreshToken also refuses an inactive admin and a family opened under an older password
    // (a rotation racing revokeAdminSessions may have minted a live successor): such a row gets
    // nothing, not even the access token of the grace path below.
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
    // successor inherits the row's credential version, never re-read from the admin.
    await app.issueRefreshToken(reply, admin.id, check.credentialVersion, check.id);
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
      if (parsed.data.isActive === false && target.id === req.adminId) {
        return reply.status(409).send(apiError('CANNOT_DEACTIVATE_SELF'));
      }
      const admin = await app.prisma.admin.update({
        where: { id: req.params.id },
        data: {
          ...(parsed.data.displayName !== undefined ? { displayName: parsed.data.displayName } : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        },
      });
      // A deactivation ends the account's sessions, whoever holds them. There is no password field
      // here (AdminPatchInput is strict): nobody resets a colleague's password.
      if (parsed.data.isActive === false) {
        await app.revokeAdminSessions(admin.id);
      }
      return { admin: toAdminDTO(admin) };
    },
  );

  // --- POST /api/v1/auth/change-password ------------------------------------
  app.post('/auth/change-password', { preHandler: app.authenticate }, async (req, reply) => {
    const parsed = ChangePasswordInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send(validationError(parsed.error));
    }
    const admin = await app.prisma.admin.findUnique({ where: { id: req.adminId! } });
    if (!admin) return reply.status(404).send(apiError('NOT_FOUND'));
    const ok = await verifyPassword(admin.passwordHash, parsed.data.currentPassword);
    if (!ok) return reply.status(401).send(apiError('INVALID_CREDENTIALS'));
    // passwordChangedAt is the credential version every access JWT carries: bumping it refuses all
    // the JWTs signed before, this request's own included.
    const updated = await app.prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: await hashPassword(parsed.data.newPassword), passwordChangedAt: new Date() },
    });
    // Every other session of this account ends (a stolen refresh cookie or access JWT included);
    // this browser gets fresh cookies so the admin who just changed their password stays signed in.
    await app.revokeAdminSessions(admin.id);
    app.issueAccessToken(reply, updated);
    await app.issueRefreshToken(reply, admin.id, updated.passwordChangedAt);
    return reply.status(204).send();
  });
}
