/**
 * Explain gate tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { shouldRunExplain, ExplainThrottle } from "../explain/explainGate";

describe("explainGate", () => {
  const originalEnv = process.env.NODE_ENV;
  let throttle: ExplainThrottle;

  beforeEach(() => {
    throttle = new ExplainThrottle();
    process.env.NODE_ENV = originalEnv;
  });

  it("should return false when explain is disabled", () => {
    expect(shouldRunExplain(6000, { enableExplain: false }, throttle)).toBe(false);
  });

  it("should return false when duration is below threshold", () => {
    expect(
      shouldRunExplain(1000, { enableExplain: true, explainThresholdMs: 5000 }, throttle),
    ).toBe(false);
  });

  it("should return true when conditions are met", () => {
    expect(
      shouldRunExplain(6000, { enableExplain: true, explainThresholdMs: 5000 }, throttle),
    ).toBe(true);
  });

  it("should block in production unless allowExplainInProd is true", () => {
    process.env.NODE_ENV = "production";
    expect(
      shouldRunExplain(6000, { enableExplain: true, allowExplainInProd: false }, throttle),
    ).toBe(false);
    expect(
      shouldRunExplain(6000, { enableExplain: true, allowExplainInProd: true }, throttle),
    ).toBe(true);
  });

  it("should throttle to max 1 per minute", () => {
    const config = { enableExplain: true, explainThresholdMs: 1000 };

    // First call should succeed
    expect(shouldRunExplain(2000, config, throttle)).toBe(true);

    // Second call immediately after should fail (throttled)
    expect(shouldRunExplain(2000, config, throttle)).toBe(false);
  });

  it("should use default explainThresholdMs when not provided", () => {
    expect(shouldRunExplain(6000, { enableExplain: true }, throttle)).toBe(true);
    expect(shouldRunExplain(4000, { enableExplain: true }, throttle)).toBe(false);
  });
});
