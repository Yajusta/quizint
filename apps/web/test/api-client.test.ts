// rawRequest's 401 rule: an expired session is refreshed and retried once; a wrong password is not.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiErrorThrown, apiJson } from '../src/lib/api-client.ts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const calls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map(([url]) => String(url));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client 401 handling', () => {
  it('refreshes and retries once on an expired session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiJson.post('/auth/change-password', {}, z.unknown());
    expect(calls(fetchMock)).toEqual([
      '/api/v1/auth/change-password',
      '/api/v1/auth/refresh',
      '/api/v1/auth/change-password',
    ]);
  });

  it('does not resend a wrong current password', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'x' } }));
    vi.stubGlobal('fetch', fetchMock);
    const err = await apiJson.post('/auth/change-password', {}, z.unknown()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiErrorThrown);
    expect((err as ApiErrorThrown).code).toBe('INVALID_CREDENTIALS');
    expect(calls(fetchMock)).toEqual(['/api/v1/auth/change-password']);
  });
});
