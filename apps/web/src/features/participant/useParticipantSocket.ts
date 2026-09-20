// Participant socket hook (§6.6): join/resume with token, error recovery, retry on RATE_LIMITED.

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { AnswerSubmission } from '@quiz/shared';

import { useParticipantLive } from './live-store';
import { clearParticipant, loadParticipant, saveParticipant } from '../../lib/participant-storage';

/** Pause before resuming again after a transient server error on the handshake. */
const RESUME_RETRY_MS = 2000;
/** Pause before resuming again after RATE_LIMITED, spread so a room does not retry in lockstep. */
const RATE_LIMIT_RETRY_MIN_MS = 3000;
const RATE_LIMIT_RETRY_SPREAD_MS = 5000;

export function useParticipantSocket(code: string) {
  const socketRef = useRef<Socket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Error code of the last refused join (`NICKNAME_TAKEN`…), cleared by a successful one. */
  const [joinErrorCode, setJoinErrorCode] = useState<string | null>(null);
  /** A stored token is being resumed: true until its snapshot lands or the resume is refused. */
  const [resumePending, setResumePending] = useState(() => loadParticipant(code)?.token !== undefined);
  const attach = useParticipantLive((s) => s.attach);
  const markKicked = useParticipantLive((s) => s.markKicked);
  const reset = useParticipantLive((s) => s.reset);

  const connect = useCallback(
    (token?: string) => {
      const socket = io('/participant', token ? { auth: { token } } : {});
      socketRef.current = socket;
      attach(socket);

      if (token) socket.once('state:snapshot', () => setResumePending(false));
      // Bound on every socket, not only the resuming one: a socket that joined fresh re-handshakes
      // with the token `join` put in `socket.auth`, and a refusal there destroys it too.
      socket.on('connect_error', (err: Error & { data?: { code?: string } }) => {
        // Only a middleware refusal carries `data.code`; a transport error (Wi-Fi blip, API
        // restart) is a bare Error that socket.io retries on its own and must not cost the token.
        const refusal = err.data?.code;
        if (!refusal) return;
        // The token this socket handshakes with: the stored one, or the one `join` set later.
        const current = (socket.auth as { token?: string }).token;
        if (refusal === 'INTERNAL' || refusal === 'RATE_LIMITED') {
          // Transient (the snapshot failed) or a reconnect storm throttled by the API: the seat and
          // score are intact, so the token is kept and the handshake retried after a pause instead
          // of forfeiting them. socket.io never retries a middleware refusal on its own.
          socket.close();
          const delay =
            refusal === 'RATE_LIMITED'
              ? RATE_LIMIT_RETRY_MIN_MS + Math.random() * RATE_LIMIT_RETRY_SPREAD_MS
              : RESUME_RETRY_MS;
          retryRef.current = setTimeout(() => connect(current), delay);
          return;
        }
        setResumePending(false);
        if (refusal === 'KICKED') {
          // The refused socket is destroyed by the client: no retry, so the store learns it here.
          markKicked();
          return;
        }
        // TOKEN_INVALID, SESSION_ENDED, SESSION_NOT_FOUND: fall back to the nickname screen (the
        // REST lookup tells the page whether the session is closed or gone).
        clearParticipant(code);
        socket.close();
        connect();
      });
      return socket;
    },
    [attach, code, markKicked],
  );

  useEffect(() => {
    const stored = loadParticipant(code);
    connect(stored?.token);
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = null;
      // The ref, not the closure: a refused resume replaced the socket with a fresh one.
      socketRef.current?.close();
      socketRef.current = null;
      reset();
    };
  }, [code, connect, reset]);

  const join = useCallback(
    (nickname: string) =>
      new Promise<{ ok: boolean; code?: string }>((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve({ ok: false, code: 'INTERNAL' });
        // Bounded wait: without an ack the nickname screen would spin forever instead of offering a retry.
        socket.timeout(5000).emit(
          'participant:join',
          // The REST lookup uppercases, JoinCommand does not: a hand-typed /j/abc234 must join.
          { code: code.toUpperCase(), nickname },
          (err: unknown, ack: { ok: boolean; code?: string; token?: string; participantId?: string }) => {
            if (err) {
              setJoinErrorCode('TIMEOUT');
              return resolve({ ok: false, code: 'TIMEOUT' });
            }
            if (ack.ok && ack.token && ack.participantId) {
              saveParticipant(code, { token: ack.token, participantId: ack.participantId, nickname });
              // socket.io re-handshakes with `socket.auth` on every auto-reconnect: without the token
              // there, a Wi-Fi blip would silently turn this participant into an anonymous socket.
              socket.auth = { token: ack.token };
              setJoinErrorCode(null);
              resolve({ ok: true });
            } else {
              setJoinErrorCode(ack.code ?? 'INTERNAL');
              resolve({ ok: false, code: ack.code });
            }
          },
        );
      }),
    [code],
  );

  const submitAnswer = useCallback(
    (questionIndex: number, answer: AnswerSubmission) =>
      new Promise<{ ok: boolean; code?: string }>((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve({ ok: false, code: 'INTERNAL' });
        socket
          .timeout(5000)
          .emit(
            'answer:submit',
            { questionIndex, answer },
            (err: unknown, ack: { ok: boolean; code?: string }) => {
              if (err) return resolve({ ok: false, code: 'TIMEOUT' });
              resolve({ ok: ack?.ok ?? false, code: ack?.code });
            },
          );
      }),
    [],
  );

  return { join, joinErrorCode, submitAnswer, resumePending };
}
