// Shared API helpers: error responses, cookie names, small formatting helpers.

import { createHash } from 'node:crypto';

import type { FastifyReply } from 'fastify';
import { z } from 'zod';

import { errorMessage, type AccountRole } from '@quiz/shared';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export interface ApiErrorPayload {
  error: { code: string; message: string; details?: unknown };
}

/** The error envelope every REST route answers with. */
export function apiError(code: string, details?: unknown): ApiErrorPayload {
  return { error: { code, message: errorMessage(code), details } };
}

/** Body of the 400 a route answers when its Zod schema refuses the input. */
export function validationError(error: z.ZodError): ApiErrorPayload {
  return apiError('VALIDATION', z.prettifyError(error));
}

// --- JWT access token --------------------------------------------------------

export interface AdminJwtPayload {
  sub: string; // adminId
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** preHandler after `authenticate`: 403 FORBIDDEN unless the account is an ADMIN. */
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    adminId: string | null;
    /** The account's role as read from the database by `authenticate`, on this very request. */
    adminRole: AccountRole | null;
  }
}

// --- Misc ---------------------------------------------------------------------

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** ASCII file-name slug for downloads; falls back to `quiz`. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'quiz'
  );
}

export function joinUrl(publicUrl: string, code: string): string {
  return `${publicUrl.replace(/\/+$/, '')}/j/${code}`;
}
