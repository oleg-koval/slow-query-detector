/**
 * Detector tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runWithDbContext } from "../context";
import { SlowQueryDetector } from "../detector";
import type {
  ILogger,
  IEventSink,
  QueryEvent,
  DetectorEvent,
  RequestBudgetViolationEvent,
} from "../types";
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

  it("should emit request budget violation once when maxQueries exceeded", async () => {
    const contextProvider = {
      getContext: () => ({ requestId: "req-budget", userId: "u" }),
    };
    const detector = new SlowQueryDetector(
      { warnThresholdMs: 999_999, requestBudget: { maxQueries: 2 } },
      contextProvider,
      [mockSink],
    );

    for (let i = 0; i < 3; i++) {
      await detector.executeQuery(async () => [], { sql: `SELECT ${i}`, params: [] });
    }

    const events = sinkHandle.mock.calls.map((c) => c[0] as DetectorEvent);
    expect(events.filter((e) => e.event === "db.request.budget")).toHaveLength(1);
    expect(events.filter((e) => e.event === "db.query")).toHaveLength(3);
  });

  it("counts failed queries toward request budget (same as successful)", async () => {
    const contextProvider = {
      getContext: () => ({ requestId: "req-err-budget" }),
    };
    const detector = new SlowQueryDetector(
      { warnThresholdMs: 999_999, requestBudget: { maxQueries: 1 } },
      contextProvider,
      [mockSink],
    );

    await expect(
      detector.executeQuery(
        async () => {
          throw new Error("fail-one");
        },
        { sql: "SELECT 1", params: [] },
      ),
    ).rejects.toThrow("fail-one");

    await expect(
      detector.executeQuery(
        async () => {
          throw new Error("fail-two");
        },
        { sql: "SELECT 2", params: [] },
      ),
    ).rejects.toThrow("fail-two");

    const budgets = sinkHandle.mock.calls
      .map((c) => c[0])
      .filter((e): e is RequestBudgetViolationEvent => {
        return (
          typeof e === "object" &&
          e !== null &&
          "event" in e &&
          (e as { event: string }).event === "db.request.budget"
        );
      });
    expect(budgets).toHaveLength(1);
    expect(budgets[0]?.queryCount).toBe(2);

    const errors = sinkHandle.mock.calls
      .map((c) => c[0])
      .filter((e): e is QueryEvent => {
        return (
          typeof e === "object" &&
          e !== null &&
          "event" in e &&
          (e as QueryEvent).event === "db.query" &&
          (e as QueryEvent).subtype === "error"
        );
      });
    expect(errors).toHaveLength(2);
  });

  it("does not read AsyncLocalStorage when contextProvider is undefined (factory vs constructor)", async () => {
    const detector = new SlowQueryDetector(
      { warnThresholdMs: 999_999, requestBudget: { maxQueries: 1 } },
      undefined,
      [mockSink],
    );

    await runWithDbContext({ requestId: "als-only" }, async () => {
      await detector.executeQuery(async () => [], { sql: "SELECT 1", params: [] });
      await detector.executeQuery(async () => [], { sql: "SELECT 2", params: [] });
    });

    const budgets = sinkHandle.mock.calls.filter(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event === "db.request.budget",
    );
    expect(budgets).toHaveLength(0);
  });

  it("emits only one budget violation when maxQueries trips first; later work exceeds maxTotalDurationMs without a second emission", async () => {
    const contextProvider = {
      getContext: () => ({ requestId: "dual-limit" }),
    };
    const detector = new SlowQueryDetector(
      {
        warnThresholdMs: 999_999,
        // Third query exceeds maxQueries; fourth adds enough duration that cumulative total > maxTotalDurationMs,
        // but violationEmitted already suppresses a second db.request.budget event.
        requestBudget: { maxQueries: 2, maxTotalDurationMs: 20 },
      },
      contextProvider,
      [mockSink],
    );

    await detector.executeQuery(async () => [], { sql: "SELECT 0", params: [] });
    await detector.executeQuery(async () => [], { sql: "SELECT 1", params: [] });
    await detector.executeQuery(async () => [], { sql: "SELECT 2", params: [] });

    await detector.executeQuery(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [];
      },
      { sql: "SELECT slow", params: [] },
    );

    const budgetEvents = sinkHandle.mock.calls.filter(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event === "db.request.budget",
    );
    expect(budgetEvents).toHaveLength(1);
  });
});
