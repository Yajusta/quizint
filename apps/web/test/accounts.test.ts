// Account page rule: which API refusals the page translates instead of showing the server's French
// message.

import { describe, expect, it } from 'vitest';

import { ApiErrorThrown } from '../src/lib/api-client.ts';
import { accountErrorCode } from '../src/pages/admin/accounts.ts';

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
