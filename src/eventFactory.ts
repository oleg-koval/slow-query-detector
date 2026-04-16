/**
 * Event factory for creating structured query events
 */

import type {
  QueryEvent,
  QueryMetadata,
  QuerySubtype,
  SlowQueryDetectorConfig,
  IContextProvider,
} from "./types";
import { resolveDetectorContext } from "./context";
import { sanitizeSql, redactParams } from "./redaction";

/**
 * Create a structured query event
 */
export function createQueryEvent(
  metadata: QueryMetadata,
  subtype: QuerySubtype,
  config: SlowQueryDetectorConfig,
  contextProvider?: IContextProvider,
): QueryEvent {
  const context = resolveDetectorContext(contextProvider);

  const sanitizedSql = sanitizeSql(metadata.sql);
  const redactedParams = redactParams(metadata.params, config.paramsRedactor);

  const event: QueryEvent = {
    event: "db.query",
    subtype,
    durationMs: metadata.durationMs,
    timestamp: new Date().toISOString(),
    sql: sanitizedSql,
    params: redactedParams,
    rowCount: metadata.rowCount,
    dbName: config.dbName,
    queryName: metadata.queryName,
    requestId: context.requestId,
    userId: context.userId,
  };

  if (metadata.error) {
    event.errorName = metadata.error.name;
    event.errorMessage = metadata.error.message;

    if (config.includeStackTrace && metadata.error.stack) {
      event.stackTrace = metadata.error.stack;
    }
  }

  return event;
}
