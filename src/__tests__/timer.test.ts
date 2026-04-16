/**
 * Timer tests
 */

import { describe, it, expect } from "vitest";
import { startTimer } from "../timer";

describe("timer", () => {
  it("should measure duration accurately", async () => {
    const stopTimer = startTimer();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const durationMs = stopTimer();

    expect(durationMs).toBeGreaterThanOrEqual(8);
    expect(durationMs).toBeLessThan(50);
  });

  it("should return milliseconds", () => {
    const stopTimer = startTimer();
    const durationMs = stopTimer();

    expect(typeof durationMs).toBe("number");
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should measure very short durations", () => {
    const stopTimer = startTimer();
    const durationMs = stopTimer();

    expect(durationMs).toBeLessThan(10);
  });
});
