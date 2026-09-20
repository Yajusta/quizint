// Auth plugin — @fastify/jwt + @fastify/cookie, Argon2id passwords,
// rotating opaque refresh tokens (§5.1, §10).

import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';

import { getConfig } from '../config.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  apiError,
  sha256,
  type AdminJwtPayload,
} from '../lib/api.js';

const ACCESS_TTL_SEC = 15 * 60; // 15 min
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 days
/**
 * A refresh token revoked this recently is a concurrent rotation, not a theft: two tabs of one
 * browser (admin page on a 401, presenter page on its proactive timer) share the cookie and can
 * both present it within the same second. The window is anchored on the first revocation (it never
 * slides, see issueRefreshToken); beyond it a revoked token is reuse and the family is revoked.
 * Logout and theft detection expire the token outright, so neither is covered by the grace.
 */
const REFRESH_ROTATION_GRACE_MS = 10_000;

function cookieOpts(maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge,
  };
}

async function plugin(app: FastifyInstance): Promise<void> {
  const config = getConfig();
  await app.register(cookie);
  await app.register(jwt, { secret: config.JWT_SECRET });

  // Decorate request with the admin identity.
  app.decorateRequest('adminId', null);

  // authenticate guard — use as preHandler on protected routes.
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies[ACCESS_TOKEN_COOKIE];
    if (!token) return reply.status(401).send(apiError('UNAUTHORIZED'));
    let adminId: string;
    try {
      adminId = app.jwt.verify<AdminJwtPayload>(token).sub;
    } catch {
      return reply.status(401).send(apiError('UNAUTHORIZED'));
    }
    // A deactivated (or deleted) admin must lose access at once, not when the 15-min JWT expires:
    // one indexed lookup per request on a local SQLite file.
    const admin = await app.prisma.admin.findUnique({ where: { id: adminId }, select: { isActive: true } });
    if (!admin?.isActive) return reply.status(401).send(apiError('UNAUTHORIZED'));
    req.adminId = adminId;
  });

  // Issue the access JWT cookie.
  app.decorate('issueAccessToken', (reply: FastifyReply, adminId: string, email: string) => {
    const token = app.jwt.sign({ sub: adminId, email }, { expiresIn: ACCESS_TTL_SEC });
    reply.setCookie(ACCESS_TOKEN_COOKIE, token, cookieOpts(ACCESS_TTL_SEC));
    return token;
  });

  // Issue a new opaque refresh token (rotating): revoke the old one, store sha256 of the new.
  app.decorate(
    'issueRefreshToken',
    async (reply: FastifyReply, adminId: string, previousToken: string | undefined) => {
      if (previousToken) {
        // Only a live token gets a revocation time: re-stamping an already revoked one on every
        // replay would slide the grace window and let a replayed token mint sessions forever.
        await app.prisma.refreshToken.updateMany({
          where: { tokenHash: sha256(previousToken), revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      const token = randomBytes(32).toString('base64url');
      await app.prisma.refreshToken.create({
        data: {
          adminId,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
        },
      });
      // Opportunistic purge: every rotation leaves a dead row behind (expired 7 days later, revoked
      // at once), nothing else would ever remove them. Failure here must not fail the refresh.
      app.prisma.refreshToken
        .deleteMany({ where: { adminId, expiresAt: { lt: new Date() } } })
        .catch((err: unknown) => app.log.error({ err, adminId }, 'refresh token purge failed'));
      reply.setCookie(REFRESH_TOKEN_COOKIE, token, cookieOpts(REFRESH_TTL_SEC));
      return token;
    },
  );

  /**
   * Ends every session of an admin: refresh tokens revoked and expired (no rotation grace), and
   * their presenter sockets disconnected. Called on password change, password reset by a colleague
   * and deactivation, so credential rotation actually ends an attacker's session. Access JWTs live
   * at most 15 min and `authenticate` re-checks `isActive` on every request.
   */
  app.decorate('revokeAdminSessions', async (adminId: string) => {
    const at = new Date();
    await app.prisma.refreshToken.updateMany({
      where: { adminId, revokedAt: null },
      data: { revokedAt: at, expiresAt: at },
    });
    for (const socket of app.io.of('/presenter').sockets.values()) {
      if ((socket.data as { adminId?: string }).adminId === adminId) socket.disconnect(true);
    }
  });

  // Verify a refresh token and detect reuse of a revoked one (→ revoke the whole family).
  app.decorate('verifyRefreshToken', async (req: FastifyRequest) => {
    const token = req.cookies[REFRESH_TOKEN_COOKIE];
    if (!token) return null;
    const row = await app.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.expiresAt < new Date()) return null;
    if (row.revokedAt && Date.now() - row.revokedAt.getTime() > REFRESH_ROTATION_GRACE_MS) {
      // Reuse detected: revoke every token of this admin's family. Expired as well, so the grace
      // window above (a *rotation* revocation) never lets a stolen family through.
      const at = new Date();
      await app.prisma.refreshToken.updateMany({
        where: { adminId: row.adminId, revokedAt: null },
        data: { revokedAt: at, expiresAt: at },
      });
      return null;
    }
    // Fresh, or revoked within the grace window by a concurrent rotation: the caller rotates
    // again and the loser of the race still leaves with a valid cookie.
    return row;
  });

  app.decorate('clearAuthCookies', (reply: FastifyReply) => {
    reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    issueAccessToken: (reply: FastifyReply, adminId: string, email: string) => string;
    issueRefreshToken: (reply: FastifyReply, adminId: string, previousToken?: string) => Promise<string>;
    verifyRefreshToken: (req: FastifyRequest) => Promise<{ id: string; adminId: string } | null>;
    revokeAdminSessions: (adminId: string) => Promise<void>;
    clearAuthCookies: (reply: FastifyReply) => void;
  }
}

export const authPlugin = fp(plugin, { name: 'auth' });
