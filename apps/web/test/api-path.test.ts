// apiPath: route params are one encoded segment each, never a path of their own.

import { describe, expect, it } from 'vitest';

import { apiPath } from '../src/lib/api-client.ts';

describe('apiPath', () => {
  it('leaves plain identifiers untouched', () => {
    expect(apiPath`/quizzes/${'abc123'}/sessions`).toBe('/quizzes/abc123/sessions');
  });

  it('encodes separators and dot segments so a param cannot retarget the request', () => {
    expect(apiPath`/sessions/${'../admins'}`).toBe('/sessions/..%2Fadmins');
    expect(apiPath`/quizzes/${'a?b#c'}`).toBe('/quizzes/a%3Fb%23c');
  });

  it('encodes query values too', () => {
    expect(apiPath`/sessions/${'s1'}/export.csv?kind=${'a&b=c'}`).toBe(
      '/sessions/s1/export.csv?kind=a%26b%3Dc',
    );
  });
});
