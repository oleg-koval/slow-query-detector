/**
 * Tests for EXPLAIN async behavior
 * Tests that EXPLAIN doesn't block query completion
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlowQueryDetector } from "../detector";
import type { IExplainRunner, ILogger } from "../types";
import { LoggerSink } from "../sinks/loggerSink";

describe("detector EXPLAIN async behavior", () => {
  let mockLogger: ILogger;
  let mockExplainRunner: IExplainRunner;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockExplainRunner = {
      runExplain: vi.fn().mockResolvedValue("EXPLAIN result"),
    };
  });

  it("should not await EXPLAIN completion", async () => {
    // Make EXPLAIN slow
    mockExplainRunner.runExplain = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return "EXPLAIN result";
    });

    const detector = new SlowQueryDetector(
      {
        enableExplain: true,
        explainThresholdMs: 100, // Lower threshold so EXPLAIN triggers
        warnThresholdMs: 2000,
      },
      undefined,
      [new LoggerSink(mockLogger, {})],
      mockExplainRunner,
    );

    const startTime = Date.now();

    // Query takes 150ms (above explainThresholdMs of 100ms)
    await detector.executeQuery(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return [{ id: 1 }];
      },
      {
        sql: "SELECT * FROM users",
        params: [],
      },
    );

    const duration = Date.now() - startTime;

    // Query should complete in ~150ms, not wait for EXPLAIN (now async)
    // If EXPLAIN was awaited, it would be ~250ms (150ms query + 100ms EXPLAIN)
    expect(duration).toBeLessThan(200); // Should be ~150ms, not ~250ms

    // Wait a bit for async EXPLAIN to be called
    await new Promise((resolve) => setTimeout(resolve, 50));

    // EXPLAIN should have been called (but not awaited)
    expect(mockExplainRunner.runExplain).toHaveBeenCalled();
  });

  it("should handle EXPLAIN errors without affecting query", async () => {
    mockExplainRunner.runExplain = vi.fn().mockRejectedValue(new Error("EXPLAIN failed"));

    const detector = new SlowQueryDetector(
      {
        enableExplain: true,
        explainThresholdMs: 100, // Lower threshold so EXPLAIN triggers
        warnThresholdMs: 2000,
      },
      undefined,
      [new LoggerSink(mockLogger, {})],
      mockExplainRunner,
    );

    // Query takes 150ms (above explainThresholdMs)
    const result = await detector.executeQuery(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return [{ id: 1 }];
      },
      {
        sql: "SELECT * FROM users",
        params: [],
      },
    );

    // Query should succeed even if EXPLAIN fails
    expect(result).toEqual([{ id: 1 }]);

    // Wait a bit for async EXPLAIN to be called
    await new Promise((resolve) => setTimeout(resolve, 50));

    // EXPLAIN should have been called (but error shouldn't affect query)
    expect(mockExplainRunner.runExplain).toHaveBeenCalled();
  });
});
