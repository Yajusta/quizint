// Account page rules: no management action on one's own row, and which API refusals the page
// translates instead of showing the server's French message.

import { describe, expect, it } from 'vitest';

import { ApiErrorThrown } from '../src/lib/api-client.ts';
import { accountErrorCode, accountRowActions } from '../src/pages/admin/accounts.ts';

const ME = '00000000-0000-4000-8000-00000000000a';
const OTHER = '00000000-0000-4000-8000-00000000000b';

describe('accountRowActions', () => {
  it('offers every action on another account', () => {
    expect(accountRowActions({ id: OTHER }, ME)).toEqual({
      toggleActive: true,
      changeRole: true,
      resetPassword: true,
    });
  });

  it('offers nothing on the own row (the change-password card covers it)', () => {
    expect(accountRowActions({ id: ME }, ME)).toEqual({
      toggleActive: false,
      changeRole: false,
      resetPassword: false,
    });
  });
});

describe('accountErrorCode', () => {
  it('recognises the account refusals', () => {
    for (const code of ['FORBIDDEN', 'LAST_ADMIN', 'CANNOT_RESET_OWN_PASSWORD', 'RATE_LIMITED']) {
      expect(accountErrorCode(new ApiErrorThrown(409, code, 'x'))).toBe(code);
    }
  });

  it('leaves other codes and non-API errors to the server message or the fallback', () => {
    expect(accountErrorCode(new ApiErrorThrown(409, 'VALIDATION', 'x'))).toBeNull();
    expect(accountErrorCode(new Error('network'))).toBeNull();
  });
});
