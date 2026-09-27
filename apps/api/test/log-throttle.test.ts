import { describe, expect, it } from 'vitest';

import { LogThrottle } from '../src/lib/log-throttle.js';

describe('LogThrottle', () => {
  it('writes the first line, drops the rest of the interval, then reports how many it dropped', () => {
    const clock = { now: 1_000_000 };
    const t = new LogThrottle(10_000, () => clock.now);
    expect(t.take()).toBe(0);
    for (let i = 0; i < 500; i++) {
      clock.now += 10;
      expect(t.take()).toBeNull();
    }
    // 5 s since the line written: still inside the interval.
    expect(t.take()).toBeNull();
    clock.now = 1_000_000 + 10_000;
    expect(t.take()).toBe(501);
    // The count starts over with each line written.
    clock.now += 1;
    expect(t.take()).toBeNull();
    clock.now += 10_000;
    expect(t.take()).toBe(1);
  });

  it('a quiet period writes every line, with nothing suppressed', () => {
    const clock = { now: 0 };
    const t = new LogThrottle(1_000, () => clock.now);
    for (let i = 0; i < 3; i++) {
      expect(t.take()).toBe(0);
      clock.now += 1_000;
    }
  });
});
