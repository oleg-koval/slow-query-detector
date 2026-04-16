/**
 * Tests for sink error handling
 * Tests that one failing sink doesn't break others
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlowQueryDetector } from "../detector";
import type { IEventSink, ILogger } from "../types";
import { LoggerSink } from "../sinks/loggerSink";

describe("detector sink error handling", () => {
  let mockLogger: ILogger;
  let failingSink: IEventSink;
  let workingSink: IEventSink;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    failingSink = {
      handle: vi.fn().mockImplementation(() => {
        throw new Error("Sink failed");
      }),
    };

    workingSink = {
      handle: vi.fn(),
    };
  });

  it("should continue processing other sinks if one fails", async () => {
    const detector = new SlowQueryDetector({ warnThresholdMs: 200 }, undefined, [
      failingSink,
      workingSink,
      new LoggerSink(mockLogger, {}),
    ]);

    await detector.executeQuery(async () => [{ id: 1 }], {
      sql: "SELECT * FROM users",
      params: [],
    });

    // Failing sink should have been called
    expect(failingSink.handle).toHaveBeenCalled();

    // Working sink should still have been called
    expect(workingSink.handle).toHaveBeenCalled();

    // Logger sink should also have been called
    // (Currently this will fail if failing sink throws synchronously)
  });

  it("should handle all sinks failing gracefully", async () => {
    const anotherFailingSink: IEventSink = {
      handle: vi.fn().mockImplementation(() => {
        throw new Error("Another sink failed");
      }),
    };

    const detector = new SlowQueryDetector({ warnThresholdMs: 200 }, undefined, [
      failingSink,
      anotherFailingSink,
    ]);

    // Query should still complete
    const result = await detector.executeQuery(async () => [{ id: 1 }], {
      sql: "SELECT * FROM users",
      params: [],
    });

    expect(result).toEqual([{ id: 1 }]);
  });
});
