// Presenter socket hook (§6.6): JWT refresh before connect, auth-refusal recovery,
// proactive refresh every 10 min while a live view is open.

import { useCallback, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { refreshSession } from '../../lib/api-client.ts';
import { usePresenterLive } from './live-store';

/** Handshake refusals that a token refresh can fix. An expired access cookie is no longer sent at
 * all, so the server answers UNAUTHORIZED rather than TOKEN_EXPIRED: both are recoverable. */
const RECOVERABLE_CODES = new Set(['TOKEN_EXPIRED', 'UNAUTHORIZED']);
/** Consecutive refused handshakes before giving up (refresh token gone: the banner stays). */
const MAX_AUTH_RETRIES = 3;

export function usePresenterSocket(sessionId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const attach = usePresenterLive((s) => s.attach);
  const reset = usePresenterLive((s) => s.reset);

  useEffect(() => {
    if (!sessionId) return;
    let disposed = false;
    let authFailures = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      // Refresh the JWT BEFORE any socket (re)connection (§5.1).
      await refreshSession();
      if (disposed) return;
      const socket = io('/presenter', { auth: { sessionId } });
      socketRef.current = socket;
      attach(socket);
      socket.on('connect', () => {
        authFailures = 0;
      });
      // socket.io retries transport errors by itself, but never a middleware refusal: every
      // replacement socket carries this same handler, so a second expiry is recovered too.
      socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
        if (disposed || !RECOVERABLE_CODES.has(err.data?.code ?? '')) return;
        socket.close();
        if (authFailures >= MAX_AUTH_RETRIES) return;
        authFailures += 1;
        retryTimer = setTimeout(() => void connect(), 1000 * authFailures);
      });
    };

    void connect();
    // Proactive refresh while a live view is open (§5.1).
    const interval = setInterval(() => void refreshSession(), 10 * 60 * 1000);

    return () => {
      disposed = true;
      clearInterval(interval);
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
      reset();
    };
  }, [sessionId, attach, reset]);

  const command = useCallback(
    <T extends Record<string, unknown>>(event: string, payload: unknown) =>
      new Promise<T | { ok: false; code: string }>((resolve) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) return resolve({ ok: false, code: 'NOT_CONNECTED' });
        socket.timeout(5000).emit(event, payload, (err: unknown, ack: T & { ok: boolean; code?: string }) => {
          if (err) return resolve({ ok: false, code: 'TIMEOUT' });
          resolve(ack);
        });
      }),
    [],
  );

  return { command };
}
