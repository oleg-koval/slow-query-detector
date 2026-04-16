/**
 * Factory behavior that affects production integration (array mutation, sink wiring).
 */

import { describe, it, expect, vi } from "vitest";
import { createSlowQueryDetector, runWithDbContext } from "../index";
import { LoggerSink } from "../sinks/loggerSink";
import type { DetectorEvent, IEventSink, ILogger } from "../types";

describe("createSlowQueryDetector (contract)", () => {
  it("mutates the sinks array in-place when appending a LoggerSink", () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as ILogger;
    const sinks: IEventSink[] = [];
    createSlowQueryDetector({ warnThresholdMs: 200 }, { logger, sinks });
    expect(sinks.length).toBe(1);
    expect(sinks[0]).toBeInstanceOf(LoggerSink);
  });

  it("delivers db.request.budget events to custom sinks that accept DetectorEvent", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as ILogger;
    const events: DetectorEvent["event"][] = [];
    const custom: IEventSink = {
      handle(e: DetectorEvent): void {
        events.push(e.event);
      },
    };
    const detector = createSlowQueryDetector(
      { warnThresholdMs: 999_999, requestBudget: { maxQueries: 0 } },
      {
        logger,
        sinks: [custom],
        contextProvider: { getContext: () => ({ requestId: "custom-sink-contract" }) },
      },
    );

    await detector.executeQuery(async () => [], { sql: "SELECT 1", params: [] });

    expect(events).toContain("db.query");
    expect(events).toContain("db.request.budget");
  });

  it("defaults context to getDbContext so runWithDbContext works without explicit contextProvider", async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as ILogger;
    const detector = createSlowQueryDetector(
      { warnThresholdMs: 999_999, requestBudget: { maxQueries: 0 } },
      { logger },
    );

    await runWithDbContext({ requestId: "factory-als" }, async () => {
      await detector.executeQuery(async () => [], { sql: "SELECT 1", params: [] });
    });

    expect(logger.warn).toHaveBeenCalled();
  });
});
