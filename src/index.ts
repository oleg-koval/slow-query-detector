/**
 * Public API for queryd (slow query detector)
 */

import type { PrismaClient } from "@prisma/client";
import type { SlowQueryDetectorConfig, ILogger, IContextProvider, IEventSink } from "./types";
import { SlowQueryDetector } from "./detector";
import { LoggerSink } from "./sinks/loggerSink";
import { createExplainRunner } from "./explain/explainRunner";
import { wrapPrisma } from "./wrappers/wrapPrisma";
import { wrapQueryFn } from "./wrappers/wrapQueryFn";

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

  return new SlowQueryDetector(config, deps.contextProvider, sinks);
}

/**
 * Wrap Prisma client with slow query detection
 */
export function wrapPrismaClient<T extends PrismaClient>(
  prisma: T,
  detector: SlowQueryDetector,
): T {
  if (detector.config.enableExplain && !detector.explainRunner) {
    detector.explainRunner = createExplainRunner(prisma);
  }

  return wrapPrisma(prisma, detector);
}

export { wrapPrisma, wrapQueryFn };
export type { SlowQueryDetector } from "./detector";
export type {
  ILogger,
  IContextProvider,
  IEventSink,
  IExplainRunner,
  SlowQueryDetectorConfig,
  QueryEvent,
  QuerySubtype,
} from "./types";

export { getDbContext, runWithDbContext, type DbContext } from "./context";
export { createNoopLogger, createConsoleLogger } from "./logger";
export { DEFAULT_CONFIG } from "./config";
export { createExplainRunner } from "./explain/explainRunner";
