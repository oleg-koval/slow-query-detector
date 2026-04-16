import { describe, expect, it } from "vitest";
import { ExplainThrottle } from "../explain/throttle";

describe("ExplainThrottle concurrency", () => {
  it("handles concurrent shouldAllow calls", async () => {
    const throttle = new ExplainThrottle();
    await Promise.all([
      Promise.resolve(throttle.shouldAllow()),
      Promise.resolve(throttle.shouldAllow()),
    ]);
    const next = throttle.shouldAllow();
    expect(typeof next).toBe("boolean");
  });
});
