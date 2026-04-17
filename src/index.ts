/**
 * Public API for queryd (slow query detector) — ORM/driver agnostic core.
 * Prisma helpers live in `@olegkoval/queryd/prisma`.
 */

import type { SlowQueryDetectorConfig, ILogger, IContextProvider, IEventSink } from "./types";
import { getDbContext } from "./context";
import { SlowQueryDetector } from "./detector";
import { LoggerSink } from "./sinks/loggerSink";
import { wrapQueryFn } from "./wrappers/wrapQueryFn";
import { wrapTaggedTemplate } from "./wrappers/wrapTaggedTemplate";

/**
 * Create a slow query detector instance
 */
export function createSlowQueryDetector(
  config: SlowQueryDetectorConfig,
  deps: {
    logger: ILogger;
    contextProvider?: IContextProvider;
    sinks?: IEventSink[];
  },
): SlowQueryDetector {
  const sinks: IEventSink[] = deps.sinks ?? [];

  const hasLoggerSink = sinks.some((sink) => sink instanceof LoggerSink);
  if (!hasLoggerSink) {
    sinks.push(
      new LoggerSink(deps.logger, {
        sampleRateNormal: config.sampleRateNormal,
        sampleRateSlow: config.sampleRateSlow,
      }),
    );
  }

  const contextProvider = deps.contextProvider ?? {
    getContext: () => getDbContext(),
  };

  return new SlowQueryDetector(config, contextProvider, sinks);
}

export { wrapQueryFn, wrapTaggedTemplate };
export { extractQueryInfo } from "./wrappers/extractQueryInfo";
export type { SlowQueryDetector } from "./detector";
export type {
  ILogger,
  IContextProvider,
  IEventSink,
  IExplainRunner,
  SlowQueryDetectorConfig,
  QueryEvent,
  QuerySubtype,
  RequestBudgetConfig,
  RequestBudgetViolationEvent,
  DetectorEvent,
} from "./types";

export { getDbContext, runWithDbContext, type DbContext } from "./context";
export { createNoopLogger, createConsoleLogger } from "./logger";
export { DEFAULT_CONFIG } from "./config";
