/**
 * Type definitions and interfaces for slow query detector
 */

export type QuerySubtype = "normal" | "slow" | "very_slow" | "error";

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
 * Event sink interface for extensibility
 */
export interface IEventSink {
  handle(event: QueryEvent): void;
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
