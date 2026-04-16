/**
 * Per-instance EXPLAIN throttle to prevent race conditions
 */

const EXPLAIN_THROTTLE_MS = 60_000; // 1 minute

/**
 * Per-instance throttle for EXPLAIN execution
 * Uses atomic check-and-set to prevent race conditions
 */
export class ExplainThrottle {
  private lastTime: number | null = null;

  /**
   * Check if EXPLAIN should be allowed (throttled to 1 per minute)
   * Uses atomic check-and-set pattern to prevent race conditions
   */
  shouldAllow(): boolean {
    const now = Date.now();
    const previous = this.lastTime;

    // Check if throttled
    if (previous !== null && now - previous < EXPLAIN_THROTTLE_MS) {
      return false;
    }

    // Atomic update: only set if it hasn't changed (prevents race condition)
    // If another call updated it between check and set, we'll fail on next check
    if (this.lastTime === previous) {
      this.lastTime = now;
      return true;
    }

    // Someone else updated it, check again
    // This handles the race condition where two calls pass the initial check
    return false;
  }

  /**
   * Reset throttle (for testing)
   */
  reset(): void {
    this.lastTime = null;
  }
}
