/**
 * In-memory per-requestId aggregation with LRU eviction.
 */

import type { RequestBudgetConfig, RequestBudgetViolationEvent } from "./types";

type Entry = {
  queryCount: number;
  totalDurationMs: number;
  violationEmitted: boolean;
};

const DEFAULT_MAX_TRACKED = 5000;

/**
 * Resolves the query-count cap used for comparisons and emitted events.
 * Negative or non-finite values are treated as "no cap" (same as omitting the field).
 * Zero is preserved: it means no queries are allowed before violation.
 */
export function effectiveMaxQueries(maxQueries: number | undefined): number | undefined {
  if (maxQueries === undefined) {
    return undefined;
  }
  if (maxQueries === 0) {
    return 0;
  }
  if (!Number.isFinite(maxQueries) || maxQueries < 0) {
    return undefined;
  }
  return maxQueries;
}

export class RequestBudgetTracker {
  private readonly map = new Map<string, Entry>();
  private readonly maxTracked: number;

  constructor(maxTrackedRequests?: number) {
    const raw = maxTrackedRequests ?? DEFAULT_MAX_TRACKED;
    const resolved = Number.isFinite(raw) ? raw : DEFAULT_MAX_TRACKED;
    this.maxTracked = Math.max(1, Math.floor(resolved));
  }

  record(
    requestId: string,
    userId: string | undefined,
    durationMs: number,
    budget: RequestBudgetConfig,
    dbName: string | undefined,
  ): RequestBudgetViolationEvent | undefined {
    if (this.map.size >= this.maxTracked && !this.map.has(requestId)) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }

    const prev = this.map.get(requestId) ?? {
      queryCount: 0,
      totalDurationMs: 0,
      violationEmitted: false,
    };

    const next: Entry = {
      queryCount: prev.queryCount + 1,
      totalDurationMs: prev.totalDurationMs + durationMs,
      violationEmitted: prev.violationEmitted,
    };

    this.map.delete(requestId);
    this.map.set(requestId, next);

    if (next.violationEmitted) {
      return undefined;
    }

    const cap = effectiveMaxQueries(budget.maxQueries);
    const overQueries = cap !== undefined && next.queryCount > cap;
    const overTotal =
      budget.maxTotalDurationMs !== undefined && next.totalDurationMs > budget.maxTotalDurationMs;

    if (!overQueries && !overTotal) {
      return undefined;
    }

    next.violationEmitted = true;
    this.map.set(requestId, next);

    const event: RequestBudgetViolationEvent = {
      event: "db.request.budget",
      subtype: "violation",
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      queryCount: next.queryCount,
      totalDurationMs: next.totalDurationMs,
      maxQueries: cap,
      maxTotalDurationMs: budget.maxTotalDurationMs,
      dbName,
    };
    return event;
  }
}
