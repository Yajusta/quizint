// Typed API client: fetch + Zod parsing, 401 → refresh → retry (§13.6).

import i18next from 'i18next';

import type { ZodType } from 'zod';

import type { ApiError, MediaDTO } from '@quiz/shared';

export class ApiErrorThrown extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

let refreshInFlight: Promise<void> | null = null;

/** Rotates the session cookies; one shared refresh at a time, never rejects. */
export function refreshSession(): Promise<void> {
  refreshInFlight ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function rawRequest(path: string, init: RequestInit, retry = true): Promise<Response> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.method && init.method !== 'GET' ? { 'X-Requested-With': 'fetch' } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/login')) {
    await refreshSession();
    return rawRequest(path, init, false);
  }
  return res;
}

/**
 * Fallback message when the response has no readable error envelope. The server did answer:
 * blaming the network would be wrong and send the user checking their connection. From 500 up the
 * failure is server-side; below, the request arrived but was not understood.
 */
function fallbackMessage(status: number): string {
  return status >= 500 ? i18next.t('common:api.serverError') : i18next.t('common:api.badRequest');
}

/** Error from a failed response and its (possibly unreadable) JSON envelope. */
function toApiError(status: number, body: unknown, fallback: string): ApiErrorThrown {
  const err = body as ApiError | null;
  return new ApiErrorThrown(
    status,
    err?.error?.code ?? 'INTERNAL',
    err?.error?.message ?? fallback,
    err?.error?.details,
  );
}

export async function api<T>(path: string, schema: ZodType<T>, init: RequestInit = {}): Promise<T> {
  const res = await rawRequest(path, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body, fallbackMessage(res.status));
  if (body === null) return undefined as T;
  return schema.parse(body);
}

export const apiJson = {
  get: <T>(path: string, schema: ZodType<T>) => api(path, schema),
  post: <T>(path: string, body: unknown, schema: ZodType<T>) =>
    api(path, schema, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, schema: ZodType<T>) =>
    api(path, schema, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown, schema: ZodType<T>) =>
    api(path, schema, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, schema: ZodType<T>) => api(path, schema, { method: 'DELETE' }),
};

// Multipart: bypasses `rawRequest`, whose JSON content type would break the form boundary, but
// keeps its 401 → refresh → retry rule: an upload after the access token expired must not fail.
export async function uploadFile(file: File): Promise<MediaDTO> {
  const form = new FormData();
  form.append('file', file);
  const post = () => fetch('/api/v1/media', { method: 'POST', body: form, credentials: 'same-origin' });
  let res = await post();
  if (res.status === 401) {
    await refreshSession();
    res = await post();
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body, 'Upload impossible');
  return (body as { media: MediaDTO }).media;
}
