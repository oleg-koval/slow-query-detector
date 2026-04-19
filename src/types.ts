/**
 * Type definitions and interfaces for slow query detector
 */

export type QuerySubtype = "normal" | "slow" | "very_slow" | "error";

/**
 * Per-request aggregate limits (requires requestId on context).
 */
export interface RequestBudgetConfig {
  /** Max completed queries per `requestId`. Omit or use only `maxTotalDurationMs` for no query cap. `0` means the first query trips the budget. Negative or non-finite values are ignored (no cap). */
  maxQueries?: number;
  maxTotalDurationMs?: number;
  /** Max distinct requestIds held in memory; LRU eviction. Default 5000. */
  maxTrackedRequests?: number;
}

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(obj: unknown): void;
  warn(obj: unknown): void;
  error(obj: unknown): void;
}

/**
 * Params redactor interface
 */
export interface IRedactor {
  redactParams(params: unknown[]): unknown[];
}

/**
 * Context provider for request/user context
 */
export interface IContextProvider {
  getContext(): {
    requestId?: string;
    userId?: string;
  };
}

/**
 * EXPLAIN runner interface
 */
export interface IExplainRunner {
  runExplain(sql: string, params: unknown[]): Promise<string>;
}

/**
 * Slow query detector configuration
 */
export interface SlowQueryDetectorConfig {
  warnThresholdMs?: number; // default: 200
  errorThresholdMs?: number; // default: 1000
  sampleRateNormal?: number; // default: 0.0
  sampleRateSlow?: number; // default: 1.0
  includeStackTrace?: boolean; // default: false
  enableExplain?: boolean; // default: false
  allowExplainInProd?: boolean; // default: false
  explainThresholdMs?: number; // default: 5000
  dbName?: string;
  paramsRedactor?: (params: unknown[]) => unknown[];
  requestBudget?: RequestBudgetConfig;
}

/**
 * Structured query event
 */
export interface QueryEvent {
  event: "db.query";
  subtype: QuerySubtype;
  durationMs: number;
  timestamp: string; // ISO
  sql: string; // sanitized
  params: unknown[]; // redacted
  rowCount?: number;
  dbName?: string;
  queryName?: string;
  requestId?: string;
  userId?: string;
  errorName?: string;
  errorMessage?: string;
  stackTrace?: string;
}

/**
 * Query metadata for event creation
 */
export interface QueryMetadata {
  sql: string;
  params: unknown[];
  durationMs: number;
  rowCount?: number;
  queryName?: string;
  error?: Error;
}

/**
 * Emitted once per requestId when aggregate limits are exceeded.
 */
export interface RequestBudgetViolationEvent {
  event: "db.request.budget";
  subtype: "violation";
  timestamp: string;
  requestId: string;
  userId?: string;
  queryCount: number;
  totalDurationMs: number;
  maxQueries?: number;
  maxTotalDurationMs?: number;
  dbName?: string;
}

export type DetectorEvent = QueryEvent | RequestBudgetViolationEvent;

/**
 * Event sink interface for extensibility
 */
export interface IEventSink {
  handle(event: DetectorEvent): void;
}
