/**
 * Request budget tracker tests
 */

import { describe, it, expect } from "vitest";
import { RequestBudgetTracker } from "../requestBudgetTracker";

describe("RequestBudgetTracker", () => {
  it("emits violation when query count exceeds maxQueries", () => {
    const t = new RequestBudgetTracker(100);
    const budget = { maxQueries: 2 };
    expect(t.record("r1", undefined, 1, budget, "db")).toBeUndefined();
    expect(t.record("r1", undefined, 1, budget, "db")).toBeUndefined();
    const v = t.record("r1", undefined, 1, budget, "db");
    expect(v).toMatchObject({
      event: "db.request.budget",
      requestId: "r1",
      queryCount: 3,
      maxQueries: 2,
      dbName: "db",
    });
    expect(t.record("r1", undefined, 1, budget, "db")).toBeUndefined();
  });

  it("emits violation when total duration exceeds maxTotalDurationMs", () => {
    const t = new RequestBudgetTracker(100);
    const budget = { maxTotalDurationMs: 25 };
    expect(t.record("r2", "u1", 10, budget, undefined)).toBeUndefined();
    expect(t.record("r2", "u1", 10, budget, undefined)).toBeUndefined();
    const v = t.record("r2", "u1", 10, budget, undefined);
    expect(v).toMatchObject({
      event: "db.request.budget",
      requestId: "r2",
      userId: "u1",
      totalDurationMs: 30,
      maxTotalDurationMs: 25,
    });
  });

  it("evicts oldest request when over capacity", () => {
    const t = new RequestBudgetTracker(2);
    const budget = { maxQueries: 10 };
    t.record("a", undefined, 1, budget, undefined);
    t.record("b", undefined, 1, budget, undefined);
    t.record("c", undefined, 1, budget, undefined);
    expect(t.record("a", undefined, 1, budget, undefined)).toBeUndefined();
  });

  it("violates on first query when maxQueries is 0", () => {
    const t = new RequestBudgetTracker(100);
    const budget = { maxQueries: 0 };
    const v = t.record("zero", undefined, 1, budget, undefined);
    expect(v).toMatchObject({
      event: "db.request.budget",
      requestId: "zero",
      queryCount: 1,
      maxQueries: 0,
    });
  });

  it("treats non-finite maxTrackedRequests like the default pool size", () => {
    const baseline = new RequestBudgetTracker(undefined);
    const fromInf = new RequestBudgetTracker(Number.POSITIVE_INFINITY);
    const fromNaN = new RequestBudgetTracker(Number.NaN);
    const budget = { maxQueries: 2 };
    for (const tracker of [baseline, fromInf, fromNaN]) {
      expect(tracker.record("r", undefined, 1, budget, undefined)).toBeUndefined();
      expect(tracker.record("r", undefined, 1, budget, undefined)).toBeUndefined();
      expect(tracker.record("r", undefined, 1, budget, undefined)).toMatchObject({
        event: "db.request.budget",
        requestId: "r",
        queryCount: 3,
      });
    }
  });

  it("never raises maxTotalDurationMs when every durationMs is zero", () => {
    const t = new RequestBudgetTracker(100);
    const budget = { maxTotalDurationMs: 5 };
    for (let i = 0; i < 30; i++) {
      expect(t.record("all-zero", undefined, 0, budget, undefined)).toBeUndefined();
    }
  });

  it("does not trip maxTotalDurationMs when summed duration becomes NaN", () => {
    const t = new RequestBudgetTracker(100);
    const budget = { maxTotalDurationMs: 10 };
    expect(t.record("nan-dur", undefined, Number.NaN, budget, undefined)).toBeUndefined();
    expect(t.record("nan-dur", undefined, Number.NaN, budget, undefined)).toBeUndefined();
    expect(t.record("nan-dur", undefined, 1, budget, undefined)).toBeUndefined();
  });

  it("never violates on query count when maxQueries is positive Infinity", () => {
    const t = new RequestBudgetTracker(50);
    const budget = { maxQueries: Number.POSITIVE_INFINITY };
    for (let i = 0; i < 20; i++) {
      expect(t.record("inf-cap", undefined, 1, budget, undefined)).toBeUndefined();
    }
  });

  it("never violates on query count when maxQueries is NaN", () => {
    const t = new RequestBudgetTracker(50);
    const budget = { maxQueries: Number.NaN };
    for (let i = 0; i < 5; i++) {
      expect(t.record("nan-q", undefined, 1, budget, undefined)).toBeUndefined();
    }
  });

  it("treats negative maxTotalDurationMs as an immediately exceeded time cap", () => {
    const t = new RequestBudgetTracker(10);
    const budget = { maxTotalDurationMs: -1 };
    expect(t.record("neg-total", undefined, 1, budget, undefined)).toMatchObject({
      event: "db.request.budget",
      totalDurationMs: 1,
      maxTotalDurationMs: -1,
    });
  });

  it("violates on first positive duration when maxTotalDurationMs is 0", () => {
    const t = new RequestBudgetTracker(10);
    const budget = { maxTotalDurationMs: 0 };
    expect(t.record("t0", undefined, 1, budget, undefined)).toMatchObject({
      event: "db.request.budget",
      totalDurationMs: 1,
      maxTotalDurationMs: 0,
    });
  });

  it("floors fractional maxTrackedRequests for eviction capacity", () => {
    const floored = new RequestBudgetTracker(2.9);
    const exact = new RequestBudgetTracker(2);
    const budget = { maxQueries: 10 };
    for (const tracker of [floored, exact]) {
      tracker.record("a", undefined, 1, budget, undefined);
      tracker.record("b", undefined, 1, budget, undefined);
      tracker.record("c", undefined, 1, budget, undefined);
      expect(tracker.record("a", undefined, 1, budget, undefined)).toBeUndefined();
    }
  });

  it("accepts very long requestId strings without throwing", () => {
    const t = new RequestBudgetTracker(100);
    const id = "z".repeat(20_000);
    expect(() => t.record(id, undefined, 1, { maxQueries: 1 }, undefined)).not.toThrow();
  });

  it("clamps non-positive maxTrackedRequests to a single LRU slot", () => {
    // Same requestId string can violate again after eviction (new Map entry).
    const t = new RequestBudgetTracker(0);
    const budget = { maxQueries: 2 };
    expect(t.record("p1", undefined, 1, budget, undefined)).toBeUndefined();
    expect(t.record("p1", undefined, 1, budget, undefined)).toBeUndefined();
    expect(t.record("p1", undefined, 1, budget, undefined)).toMatchObject({
      event: "db.request.budget",
      requestId: "p1",
    });
    expect(t.record("p2", undefined, 1, budget, undefined)).toBeUndefined();
    expect(t.record("p1", undefined, 1, budget, undefined)).toBeUndefined();
    expect(t.record("p1", undefined, 1, budget, undefined)).toBeUndefined();
    expect(t.record("p1", undefined, 1, budget, undefined)).toMatchObject({
      event: "db.request.budget",
      requestId: "p1",
    });
  });
});
