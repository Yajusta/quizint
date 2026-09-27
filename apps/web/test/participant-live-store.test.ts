// A tab whose seat was taken by a newer tab gets a namespace disconnect that socket.io-client never
// retries: the store must turn it into a terminal state, not a reconnection banner forever.

import { beforeEach, describe, expect, it } from 'vitest';
import type { Socket } from 'socket.io-client';

import { useParticipantLive } from '../src/features/participant/live-store.ts';

type Handler = (...args: unknown[]) => void;

function fakeSocket() {
  const handlers = new Map<string, Handler[]>();
  const socket = {
    on(event: string, fn: Handler) {
      handlers.set(event, [...(handlers.get(event) ?? []), fn]);
      return socket;
    },
  };
  const fire = (event: string, ...args: unknown[]) => handlers.get(event)?.forEach((fn) => fn(...args));
  return { socket: socket as unknown as Socket, fire };
}

const store = () => useParticipantLive.getState();

beforeEach(() => {
  store().reset();
});

describe('participant live store — replaced seat', () => {
  it('participant:replaced then the server disconnect ends on the replaced state', () => {
    const { socket, fire } = fakeSocket();
    store().attach(socket);
    fire('connect');
    fire('session:phase', { phase: 'LOBBY', questionIndex: -1, serverTime: Date.now() });
    fire('participant:replaced');
    fire('disconnect', 'io server disconnect');
    expect(store().replaced).toBe(true);
    expect(store().connected).toBe(false);
  });

  it('a bare server disconnect outside ENDED and kicked is treated as replaced', () => {
    const { socket, fire } = fakeSocket();
    store().attach(socket);
    fire('connect');
    fire('disconnect', 'io server disconnect');
    expect(store().replaced).toBe(true);
  });

  it('a transport drop stays a reconnection, not a terminal state', () => {
    const { socket, fire } = fakeSocket();
    store().attach(socket);
    fire('connect');
    fire('disconnect', 'transport close');
    expect(store().replaced).toBe(false);
    expect(store().connected).toBe(false);
  });

  it('the eviction after session:ended or a kick is not a replacement', () => {
    const ended = fakeSocket();
    store().attach(ended.socket);
    ended.fire('session:ended', { reason: 'ENDED' });
    ended.fire('disconnect', 'io server disconnect');
    expect(store().phase).toBe('ENDED');
    expect(store().replaced).toBe(false);

    store().reset();
    const kicked = fakeSocket();
    store().attach(kicked.socket);
    kicked.fire('participant:kicked', { message: 'x' });
    kicked.fire('disconnect', 'io server disconnect');
    expect(store().kicked).toBe(true);
    expect(store().replaced).toBe(false);
  });

  it('a reclaim refused SESSION_ENDED lands on the ended state, not on the replaced one', () => {
    const { socket, fire } = fakeSocket();
    store().attach(socket);
    fire('participant:replaced');
    store().reset();
    store().markEnded();
    expect(store().phase).toBe('ENDED');
    expect(store().replaced).toBe(false);
  });

  it('reset (the reclaim path) clears the replaced state', () => {
    const { socket, fire } = fakeSocket();
    store().attach(socket);
    fire('participant:replaced');
    store().reset();
    expect(store().replaced).toBe(false);
  });
});
