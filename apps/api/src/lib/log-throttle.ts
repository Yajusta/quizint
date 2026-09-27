// Rate-limited logging: a condition hit once per request under a flood (a saturated limiter) would
// otherwise write one line per refused request.

/**
 * At most one line per `intervalMs`. `take()` says whether to write the line now (and how many were
 * dropped since the last one written, to put on it) or to drop it. A count still pending when the
 * flood stops is only reported with the next line written.
 */
export class LogThrottle {
  private lastAt = -Infinity;
  private suppressed = 0;

  constructor(
    private readonly intervalMs: number,
    // Monotonic: a wall clock stepped back (NTP, VM restore) would silence every line until it caught up.
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** `null`: drop this line. A number: write it, with that many lines suppressed before it. */
  take(): number | null {
    const now = this.now();
    if (now - this.lastAt < this.intervalMs) {
      this.suppressed++;
      return null;
    }
    const suppressed = this.suppressed;
    this.suppressed = 0;
    this.lastAt = now;
    return suppressed;
  }
}
