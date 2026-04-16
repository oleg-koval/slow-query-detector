/**
 * Encodes production-surprise scenarios from adversarial review (each scenario = executable spec).
 * Not every scenario implies a bug — many document intentional or edge behavior.
 */

import { describe, it, expect, vi } from "vitest";
import { RequestBudgetTracker } from "../requestBudgetTracker";
import { SlowQueryDetector } from "../detector";
import type { DetectorEvent, IEventSink, QueryEvent } from "../types";

describe("request budget review scenarios", () => {
  it("uses independent Maps per RequestBudgetTracker instance (no cross-process sharing)", () => {
    const a = new RequestBudgetTracker(100);
    const b = new RequestBudgetTracker(100);
    const budget = { maxQueries: 0 };
    expect(a.record("shared-key", undefined, 1, budget, undefined)).toMatchObject({
      event: "db.request.budget",
    });
    expect(b.record("shared-key", undefined, 1, budget, undefined)).toMatchObject({
      event: "db.request.budget",
    });
  });

  it("orders overlapping query finally blocks by completion (sync before awaited microtask)", async () => {
    const contextProvider = { getContext: () => ({ requestId: "overlap-order" }) };
    const sqlOrder: string[] = [];
    const sink: IEventSink = {
      handle(e: DetectorEvent): void {
        if (e.event === "db.query") {
          sqlOrder.push((e as QueryEvent).sql);
        }
      },
    };
    const detector = new SlowQueryDetector(
      { warnThresholdMs: 999_999, requestBudget: { maxQueries: 5 } },
      contextProvider,
      [sink],
    );

    const barrier = new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    const first = detector.executeQuery(async () => {
      await barrier;
      return [];
    }, { sql: "awaits-microtask", params: [] });

    const second = detector.executeQuery(async () => [], { sql: "sync-empty", params: [] });

    await Promise.all([first, second]);

    expect(sqlOrder[0]).toBe("sync-empty");
    expect(sqlOrder[1]).toBe("awaits-microtask");
  });

  it("treats whitespace-only requestId as a real budget key (not trimmed to empty)", async () => {
    const sinkHandle = vi.fn();
    const mockSink: IEventSink = { handle: sinkHandle };
    const contextProvider = { getContext: () => ({ requestId: " " }) };
    const detector = new SlowQueryDetector(
      { warnThresholdMs: 999_999, requestBudget: { maxQueries: 0 } },
      contextProvider,
      [mockSink],
    );

    await detector.executeQuery(async () => [], { sql: "Q", params: [] });

    const violation = sinkHandle.mock.calls
      .map((c) => c[0])
      .find((e) => typeof e === "object" && e !== null && (e as { event?: string }).event === "db.request.budget");
    expect(violation).toMatchObject({ requestId: " " });
  });
});
