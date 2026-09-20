import { useEffect, useState } from 'react';

/**
 * Whole seconds left until `closesAt` (local epoch ms), or null when there is no deadline or the
 * countdown is disabled. Ticks every 200 ms but only stores whole seconds, so React re-renders the
 * consumer once per second.
 */
export function useCountdown(closesAt: number | null, enabled = true): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!closesAt || !enabled) {
      setSeconds(null);
      return;
    }
    const tick = () => setSeconds(Math.ceil(Math.max(0, closesAt - Date.now()) / 1000));
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [closesAt, enabled]);
  return seconds;
}
