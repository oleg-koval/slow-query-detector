/**
 * Detector tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlowQueryDetector } from "../detector";
import type { ILogger, IEventSink, QueryEvent } from "../types";
import { LoggerSink } from "../sinks/loggerSink";

describe("detector", () => {
  let mockLogger: ILogger;
  let sinkHandle: ReturnType<typeof vi.fn>;
  let mockSink: IEventSink;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    sinkHandle = vi.fn();
    mockSink = { handle: sinkHandle } as unknown as IEventSink;
  });

  it("should execute query and measure duration", async () => {
    const detector = new SlowQueryDetector({ warnThresholdMs: 200 }, undefined, [
      new LoggerSink(mockLogger, {}),
    ]);

    const result = await detector.executeQuery(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { data: "test" };
      },
      {
        sql: "SELECT * FROM users",
        params: [],
      },
    );

    expect(result).toEqual({ data: "test" });
    expect(sinkHandle).not.toHaveBeenCalled(); // LoggerSink handles it
  });

  it("should classify and log slow queries", async () => {
    const detector = new SlowQueryDetector({ warnThresholdMs: 50 }, undefined, [mockSink]);

    await detector.executeQuery(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return [];
      },
      {
        sql: "SELECT * FROM users",
        params: [],
      },
    );

    expect(sinkHandle).toHaveBeenCalled();
    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.subtype).toBe("slow");
    expect(event.durationMs).toBeGreaterThanOrEqual(55);
  });

  it("should handle query errors", async () => {
    const detector = new SlowQueryDetector({}, undefined, [mockSink]);

    await expect(
      detector.executeQuery(
        async () => {
          throw new Error("Database error");
        },
        {
          sql: "SELECT * FROM users",
          params: [],
        },
      ),
    ).rejects.toThrow("Database error");

    expect(sinkHandle).toHaveBeenCalled();
    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.subtype).toBe("error");
    expect(event.errorName).toBe("Error");
    expect(event.errorMessage).toBe("Database error");
  });

  it("should extract row count from array results", async () => {
    const detector = new SlowQueryDetector({}, undefined, [mockSink]);

    await detector.executeQuery(async () => [1, 2, 3, 4, 5], {
      sql: "SELECT * FROM users",
      params: [],
    });

    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.rowCount).toBe(5);
  });

  it("should include context from provider", async () => {
    const contextProvider = {
      getContext: () => ({
        requestId: "req-123",
        userId: "user-456",
      }),
    };

    const detector = new SlowQueryDetector({}, contextProvider, [mockSink]);

    await detector.executeQuery(async () => [], {
      sql: "SELECT * FROM users",
      params: [],
    });

    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.requestId).toBe("req-123");
    expect(event.userId).toBe("user-456");
  });
});
