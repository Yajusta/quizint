// Auth plugin — @fastify/jwt + @fastify/cookie, Argon2id passwords,
// rotating opaque refresh tokens (§5.1, §10).

import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import type { Admin } from '@prisma/client';
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';

import { getConfig, isDevOrTestEnv } from '../config.js';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  apiError,
  sha256,
  type AdminJwtPayload,
} from '../lib/api.js';
import { REQUEST_TX_OPTIONS } from './prisma.js';

const ACCESS_TTL_SEC = 15 * 60; // 15 min
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 days
/**
 * A refresh token revoked this recently is a concurrent rotation, not a theft: two tabs of one
 * browser (admin page on a 401, presenter page on its proactive timer) share the cookie and can
 * both present it within the same second. The window is anchored on the first revocation (it never
 * slides, see issueRefreshToken); beyond it a revoked token is reuse and the family is revoked.
 * Within it the late caller only gets a new *access* token (see issueRefreshToken): its browser
 * already holds the refresh token the first rotation minted, and a replay of a stolen cookie must not
 * mint a second, independent refresh token that no reuse check would ever catch. Logout and theft
 * detection expire the token outright, so neither is covered by the grace.
 */
export const REFRESH_ROTATION_GRACE_MS = 10_000;

// Every access JWT is HS256, issued by this API for the admin back-office. Pinned on both ends:
// verification refuses any other algorithm, issuer or audience.
export const JWT_ALGORITHM = 'HS256';
export const JWT_ISSUER = 'quiz-interactif/api';
export const JWT_AUDIENCE = 'quiz-interactif/admin';

/** Claims of an access JWT: `pca` is the admin's `passwordChangedAt` (epoch ms) when it was signed. */
interface AccessClaims extends AdminJwtPayload {
  jti: string;
  pca?: number;
  exp: number;
}

/** What the access-token check needs from an admin row. */
export interface AccessTokenSubject {
  id: string;
  email: string;
  passwordChangedAt: Date | null;
}

/**
 * Outcome of `verifyAccessToken`. `invalid`: bad signature, expired, wrong alg/iss/aud — a refresh
 * may fix it. `revoked`: a genuine token the server no longer honours (logged out, account inactive
 * or deleted, password changed since it was signed).
 */
export type AccessTokenCheck =
  { ok: true; adminId: string; email: string } | { ok: false; reason: 'invalid' | 'revoked' };

/**
 * Whether a credential version carried by a token (an access JWT's `pca`, a refresh row's
 * `credentialVersion`) is the admin's current `passwordChangedAt`. Millisecond-exact; "never
 * changed" (null/absent) only matches "never changed".
 */
export function sameCredentialVersion(
  carried: Date | number | null | undefined,
  current: Date | null,
): boolean {
  const ms = carried instanceof Date ? carried.getTime() : (carried ?? null);
  return ms === (current?.getTime() ?? null);
}

/**
 * The credential version a bump writes: now, but always strictly past the current one, so two bumps
 * in the same millisecond (or across a clock stepped back) never share a version — a token minted
 * under the first would otherwise pass the check after the second.
 */
export function nextCredentialVersion(current: Date | null): Date {
  return new Date(Math.max(Date.now(), (current?.getTime() ?? -Infinity) + 1));
}

/**
 * A refresh token `verifyRefreshToken` accepted, with its (active, same-version) admin: the row's
 * credential version is `admin.passwordChangedAt` by construction, so it is not repeated here.
 */
export interface RefreshTokenCheck {
  ok: true;
  id: string;
  admin: Admin;
}

/**
 * A refresh token `verifyRefreshToken` refused. `reuse`: a rotated token replayed beyond the grace,
 * the one refusal with a side effect (every live token of the admin revoked, again on every replay).
 * `dead`: anything else — no cookie, unknown, expired or swept, older credential version, inactive
 * admin — refused again, and inertly, on every replay.
 */
export interface RefreshTokenRefusal {
  readonly ok: false;
  readonly reason: 'dead' | 'reuse';
}

export type RefreshTokenResult = RefreshTokenCheck | RefreshTokenRefusal;

function cookieOpts(maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    // Fail closed: only an explicit development/test NODE_ENV drops `secure` (plain-http Vite dev).
    secure: !isDevOrTestEnv(getConfig().NODE_ENV),
    maxAge,
  };
}

async function plugin(app: FastifyInstance): Promise<void> {
  const config = getConfig();
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    // Global options: `app.jwt.sign(payload)` and `app.jwt.verify(token)` without per-call options use
    // exactly these (per-call options would *replace* them, not merge), live.ts included.
    sign: { algorithm: JWT_ALGORITHM, iss: JWT_ISSUER, aud: JWT_AUDIENCE, expiresIn: ACCESS_TTL_SEC },
    verify: {
      algorithms: [JWT_ALGORITHM],
      allowedIss: JWT_ISSUER,
      allowedAud: JWT_AUDIENCE,
      // fast-jwt skips the iss/aud/exp checks when the claim is simply absent: require them.
      requiredClaims: ['sub', 'iss', 'aud', 'exp'],
    },
  });

  /**
   * Access JWTs ended by a logout before their 15 min are up: sha256(token) → expiry (epoch ms).
   * In memory is enough — there is a single API process — and a restart only gives back what the
   * cookie clearing already took away from the browser.
   */
  const loggedOutAccessTokens = new Map<string, number>();

  // Decorate request with the admin identity.
  app.decorateRequest('adminId', null);

  app.decorate('verifyAccessToken', async (token: string): Promise<AccessTokenCheck> => {
    let claims: AccessClaims;
    try {
      claims = app.jwt.verify<AccessClaims>(token);
    } catch {
      return { ok: false, reason: 'invalid' };
    }
    // Almost always empty: skip the hash then.
    if (loggedOutAccessTokens.size > 0 && loggedOutAccessTokens.has(sha256(token))) {
      return { ok: false, reason: 'revoked' };
    }
    // A deactivated (or deleted) admin must lose access at once, not when the 15-min JWT expires:
    // one indexed lookup per request on a local SQLite file.
    const admin = await app.prisma.admin.findUnique({
      where: { id: claims.sub },
      select: { isActive: true, passwordChangedAt: true },
    });
    if (!admin?.isActive) return { ok: false, reason: 'revoked' };
    // Signed before the last password change: the claim is an exact copy of the column, so this
    // compares milliseconds, not the whole seconds of `iat` — the token change-password hands back
    // in the same second as the change still works, and every older one is refused.
    if (!sameCredentialVersion(claims.pca, admin.passwordChangedAt)) {
      return { ok: false, reason: 'revoked' };
    }
    return { ok: true, adminId: claims.sub, email: claims.email };
  });

  // authenticate guard — use as preHandler on protected routes.
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies[ACCESS_TOKEN_COOKIE];
    if (!token) return reply.status(401).send(apiError('UNAUTHORIZED'));
    const check = await app.verifyAccessToken(token);
    if (!check.ok) return reply.status(401).send(apiError('UNAUTHORIZED'));
    req.adminId = check.adminId;
  });

  // Issue the access JWT cookie, bound to the admin's current credential version.
  app.decorate('issueAccessToken', (reply: FastifyReply, admin: AccessTokenSubject) => {
    const claims: Omit<AccessClaims, 'exp'> = {
      sub: admin.id,
      email: admin.email,
      // Unique per token: two logins in the same second would otherwise sign byte-identical JWTs,
      // and logging one out (revokeAccessToken keys on the token) would end the other.
      jti: randomBytes(16).toString('base64url'),
      ...(admin.passwordChangedAt ? { pca: admin.passwordChangedAt.getTime() } : {}),
    };
    const token = app.jwt.sign(claims);
    reply.setCookie(ACCESS_TOKEN_COOKIE, token, cookieOpts(ACCESS_TTL_SEC));
    return token;
  });

  // Ends one access JWT before its expiry (logout). Tokens that do not verify need no entry.
  app.decorate('revokeAccessToken', (token: string) => {
    let exp: number;
    try {
      exp = app.jwt.verify<AccessClaims>(token).exp * 1000;
    } catch {
      return;
    }
    const now = Date.now();
    for (const [hash, expiresAt] of loggedOutAccessTokens) {
      if (expiresAt <= now) loggedOutAccessTokens.delete(hash);
    }
    loggedOutAccessTokens.set(sha256(token), exp);
  });

  /**
   * Issue a new opaque refresh token (rotating): revoke the old one, store sha256 of the new.
   * With a `previousId` (the row `verifyRefreshToken` accepted), only the call that actually revokes
   * it mints a successor: a token some other request already rotated (a replay inside the grace
   * window, or the loser of two concurrent refreshes) yields `null` and no cookie — one token in, at
   * most one token out.
   * `credentialVersion` is the admin's `passwordChangedAt` the family was opened under: read from the
   * admin at login and change-password; on a rotation, the admin row verifyRefreshToken read, which
   * that check just proved equal to the presented row's version (a bump landing after the read leaves
   * the successor on the old version, refused at its next use).
   */
  app.decorate(
    'issueRefreshToken',
    async (reply: FastifyReply, adminId: string, credentialVersion: Date | null, previousId?: string) => {
      const token = randomBytes(32).toString('base64url');
      const data = {
        adminId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
        credentialVersion,
      };
      if (previousId) {
        // Revoke and create in one transaction: a revokeAdminSessions sweep can no longer land
        // between them and miss the successor (the version check in verifyRefreshToken is the second
        // line).
        const minted = await app.prisma.$transaction(async (tx) => {
          // Only a live token gets a revocation time: re-stamping an already revoked one on every
          // replay would slide the grace window and let a replayed token mint sessions forever.
          // Conditional on `revokedAt: null`, so the single-writer database decides the one winner.
          const { count } = await tx.refreshToken.updateMany({
            where: { id: previousId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          if (count === 0) return false;
          await tx.refreshToken.create({ data });
          return true;
        }, REQUEST_TX_OPTIONS);
        if (!minted) return null;
      } else {
        await app.prisma.refreshToken.create({ data });
      }
      // Opportunistic purge: every rotation leaves a dead row behind (expired 7 days later, revoked
      // at once), nothing else would ever remove them. Failure here must not fail the refresh.
      app.prisma.refreshToken
        .deleteMany({ where: { adminId, expiresAt: { lte: new Date() } } })
        .catch((err: unknown) => app.log.error({ err, adminId }, 'refresh token purge failed'));
      reply.setCookie(REFRESH_TOKEN_COOKIE, token, cookieOpts(REFRESH_TTL_SEC));
      return token;
    },
  );

  /**
   * Ends every session of an admin: refresh tokens revoked and expired (no rotation grace), and
   * their presenter sockets disconnected. Called on password change and deactivation, both of which
   * bump the credential version (`passwordChangedAt`) first. Access JWTs are covered by
   * `verifyAccessToken`: it re-checks `isActive` and the credential version on every request, so a
   * JWT signed before either change is refused at once — and still after a reactivation.
   * Refresh tokens do not rely on this sweep alone either: verifyRefreshToken re-checks `isActive`
   * and the row's `credentialVersion`, so a successor minted by a rotation racing the sweep is refused.
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
  const dead: RefreshTokenRefusal = Object.freeze({ ok: false, reason: 'dead' });
  app.decorate('verifyRefreshToken', async (req: FastifyRequest): Promise<RefreshTokenResult> => {
    const token = req.cookies[REFRESH_TOKEN_COOKIE];
    if (!token) return dead;
    const row = await app.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
    // Dead at its exact expiry instant: logout and revokeAdminSessions set `expiresAt = revokedAt`,
    // and a strict `<` would let that token through (into the grace path) within the same millisecond.
    if (!row || row.expiresAt.getTime() <= Date.now()) return dead;
    // A family opened under an older credential version (a password change or a deactivation since),
    // or of an inactive admin, is dead whatever the sweep caught (a rotation racing it may have left a
    // live successor). Checked before the reuse branch: a token rotated before a password change is
    // not a theft signal about the sessions opened since, and replaying it must not revoke them.
    const admin = await app.prisma.admin.findUnique({ where: { id: row.adminId } });
    if (!admin?.isActive || !sameCredentialVersion(row.credentialVersion, admin.passwordChangedAt)) {
      return dead;
    }
    // The grace is [revokedAt, revokedAt + GRACE): at its end instant a replay is already reuse.
    if (row.revokedAt && Date.now() - row.revokedAt.getTime() >= REFRESH_ROTATION_GRACE_MS) {
      // Reuse detected: revoke every token of this admin's family. Expired as well, so the grace
      // window above (a *rotation* revocation) never lets a stolen family through.
      const at = new Date();
      await app.prisma.refreshToken.updateMany({
        where: { adminId: row.adminId, revokedAt: null },
        data: { revokedAt: at, expiresAt: at },
      });
      return { ok: false, reason: 'reuse' };
    }
    // Fresh, or revoked within the grace window by a concurrent rotation: the caller issues an access
    // token, and issueRefreshToken mints a successor only for a token that was still live.
    return { ok: true, id: row.id, admin };
  });

  app.decorate('clearAuthCookies', (reply: FastifyReply) => {
    reply.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * The one access-JWT check: signature, alg/iss/aud, expiry, logout, `isActive` and credential
     * version. Every place that accepts the `access_token` cookie (REST guard, presenter handshake)
     * must go through it.
     */
    verifyAccessToken: (token: string) => Promise<AccessTokenCheck>;
    issueAccessToken: (reply: FastifyReply, admin: AccessTokenSubject) => string;
    revokeAccessToken: (token: string) => void;
    issueRefreshToken: (
      reply: FastifyReply,
      adminId: string,
      credentialVersion: Date | null,
      previousId?: string,
    ) => Promise<string | null>;
    /**
     * The one refresh-token check: row found and unexpired, admin active, row's credential version
     * equal to the admin's, and reuse of a rotated token beyond the grace (→ family revoked).
     */
    verifyRefreshToken: (req: FastifyRequest) => Promise<RefreshTokenResult>;
    revokeAdminSessions: (adminId: string) => Promise<void>;
    clearAuthCookies: (reply: FastifyReply) => void;
  }
}

export const authPlugin = fp(plugin, { name: 'auth' });
