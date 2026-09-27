// Account page rules that need no React: which actions a row offers, which API refusals get a
// translated message of their own.

import type { AdminDTO } from '@quiz/shared';

import { ApiErrorThrown } from '../../lib/api-client.ts';

export interface AccountRowActions {
  toggleActive: boolean;
  changeRole: boolean;
  resetPassword: boolean;
}

/**
 * Actions an ADMIN is offered on one row. Nothing on their own row: their password goes through
 * « Changer mon mot de passe » (the reset route refuses self), the server refuses a
 * self-deactivation, and a self-demotion would lock them out of this very page in one click.
 */
export function accountRowActions(row: Pick<AdminDTO, 'id'>, meId: string): AccountRowActions {
  const other = row.id !== meId;
  return { toggleActive: other, changeRole: other, resetPassword: other };
}

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
] as const;
export type AccountErrorCode = (typeof ACCOUNT_ERROR_CODES)[number];

export function accountErrorCode(e: unknown): AccountErrorCode | null {
  if (!(e instanceof ApiErrorThrown)) return null;
  return (ACCOUNT_ERROR_CODES as readonly string[]).includes(e.code) ? (e.code as AccountErrorCode) : null;
}
