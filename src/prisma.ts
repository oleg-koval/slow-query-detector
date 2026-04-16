/**
 * Optional Prisma integration — import from `@olegkoval/queryd/prisma`.
 * Keeps the default package entry free of `@prisma/client`.
 */

import type { PrismaClient } from "@prisma/client";
import type { SlowQueryDetector } from "./detector";
import { createExplainRunner } from "./explain/explainRunner";
import { wrapPrisma } from "./wrappers/wrapPrisma";

export { wrapPrisma, createExplainRunner };

/**
 * Wrap Prisma client with slow query detection and optional EXPLAIN wiring.
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
