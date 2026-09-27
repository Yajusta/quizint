// Account page rule that needs no React: which API refusals get a translated message of their own.

import type { ErrorCode } from '@quiz/shared';

import { ApiErrorThrown } from '../../lib/api-client.ts';

/**
 * API refusals of the account routes that the page explains in the viewer's language. Any other
 * code keeps the server's own (French) message.
 */
export const ACCOUNT_ERROR_CODES = [
  'FORBIDDEN',
  'LAST_ADMIN',
  'CANNOT_DEACTIVATE_SELF',
  'CANNOT_RESET_OWN_PASSWORD',
  'RATE_LIMITED',
  'INVALID_CREDENTIALS',
  'NOT_FOUND',
] as const satisfies readonly ErrorCode[];
export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[number];

export function accountErrorCode(e: unknown): AccountErrorCode | null {
  if (!(e instanceof ApiErrorThrown)) return null;
  return (ACCOUNT_ERROR_CODES as readonly string[]).includes(e.code) ? (e.code as AccountErrorCode) : null;
}
