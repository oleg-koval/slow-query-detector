/**
 * Tests for EXPLAIN gate concurrent access issues
 * Tests per-instance throttling (fixes race condition)
 */

import { describe, it, expect } from "vitest";
import { shouldRunExplain, ExplainThrottle } from "../explain/explainGate";

describe("explainGate concurrent access", () => {
  it("should handle concurrent calls correctly with per-instance throttle", async () => {
    const config = {
      enableExplain: true,
      explainThresholdMs: 1000,
    };

    // Each call uses the same throttle instance (simulating same detector instance)
    const throttle = new ExplainThrottle();

    // Simulate concurrent calls with same throttle
    const results = await Promise.all([
      Promise.resolve(shouldRunExplain(2000, config, throttle)),
      Promise.resolve(shouldRunExplain(2000, config, throttle)),
      Promise.resolve(shouldRunExplain(2000, config, throttle)),
    ]);

    // With per-instance throttle, only one should pass (first one)
    // Subsequent calls should be throttled
    const trueCount = results.filter(Boolean).length;

    // Should be exactly 1 (first call passes, others throttled)
    expect(trueCount).toBe(1);
  });

  it("should throttle correctly in sequential calls", () => {
    const config = {
      enableExplain: true,
      explainThresholdMs: 1000,
    };

    const throttle = new ExplainThrottle();

    // First call should pass
    expect(shouldRunExplain(2000, config, throttle)).toBe(true);

    // Second call immediately after should fail (throttled)
    expect(shouldRunExplain(2000, config, throttle)).toBe(false);
  });

  it("should allow separate throttle instances to work independently", () => {
    const config = {
      enableExplain: true,
      explainThresholdMs: 1000,
    };

    const throttle1 = new ExplainThrottle();
    const throttle2 = new ExplainThrottle();

    // Both should pass (different instances)
    expect(shouldRunExplain(2000, config, throttle1)).toBe(true);
    expect(shouldRunExplain(2000, config, throttle2)).toBe(true);
  });
});
