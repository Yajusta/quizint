// Server clock alignment shared by the live stores: every event carrying `serverTime` refreshes the
// offset, and server deadlines are shifted onto the local clock before any countdown.

import { CLOCK_SYNC_SAMPLES } from '@quiz/shared';

const samples: number[] = [];

/**
 * `serverTime − Date.now()`, sampled on reception, smoothed as the median of the last
 * CLOCK_SYNC_SAMPLES samples: one event delayed by the network must not shift every countdown.
 */
export function clockOffsetFrom(serverTime: number): number {
  samples.push(serverTime - Date.now());
  if (samples.length > CLOCK_SYNC_SAMPLES) samples.shift();
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

/** A server epoch (or null) expressed on the local clock. */
export function toLocalTime(serverMs: number | null, clockOffset: number): number | null {
  return serverMs !== null ? serverMs - clockOffset : null;
}
