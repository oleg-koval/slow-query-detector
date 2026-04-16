/**
 * Prisma client wrapper for slow query detection
 */

import type { PrismaClient } from "@prisma/client";
import type { SlowQueryDetector } from "../detector";
import { extractQueryInfo } from "./extractQueryInfo";

/**
 * Internal marker to detect already-wrapped clients
 */
const WRAPPER_MARKER = Symbol("slowQueryDetector");

/**
 * Wrap Prisma client with slow query detection
 * Prevents double-wrapping by checking for wrapper marker
 */
export function wrapPrisma<T extends PrismaClient>(prisma: T, detector: SlowQueryDetector): T {
  if ((prisma as { [WRAPPER_MARKER]?: SlowQueryDetector })[WRAPPER_MARKER]) {
    return prisma as T;
  }

  (prisma as unknown as { [WRAPPER_MARKER]: SlowQueryDetector })[WRAPPER_MARKER] = detector;

  const pc = prisma as PrismaClient;
  const originalQueryRaw = pc.$queryRaw.bind(pc);
  const originalExecuteRaw = pc.$executeRaw.bind(pc);
  const originalTransaction = pc.$transaction.bind(pc);

  pc.$queryRaw = function (sql: TemplateStringsArray, ...values: unknown[]) {
    const { sql: sqlString, params } = extractQueryInfo(sql, ...values);

    return detector.executeQuery(() => originalQueryRaw(sql, ...values), {
      sql: sqlString,
      params,
    });
  } as typeof pc.$queryRaw;

  pc.$executeRaw = function (sql: TemplateStringsArray, ...values: unknown[]) {
    const { sql: sqlString, params } = extractQueryInfo(sql, ...values);

    return detector.executeQuery(() => originalExecuteRaw(sql, ...values), {
      sql: sqlString,
      params,
    });
  } as typeof pc.$executeRaw;

  pc.$transaction = function (fnOrOptions: unknown, options?: unknown) {
    if (typeof fnOrOptions === "function") {
      return originalTransaction(async (tx: unknown) => {
        const txClient = tx as T & { [WRAPPER_MARKER]?: SlowQueryDetector };
        if (txClient[WRAPPER_MARKER]) {
          return (fnOrOptions as (tx: unknown) => Promise<unknown>)(tx);
        }
        const wrappedTx = wrapPrisma(tx as T, detector);
        return (fnOrOptions as (tx: T) => Promise<unknown>)(wrappedTx);
      }) as ReturnType<typeof pc.$transaction>;
    }

    return originalTransaction(
      fnOrOptions as Parameters<typeof pc.$transaction>[0],
      options as Parameters<typeof pc.$transaction>[1],
    );
  } as typeof pc.$transaction;

  return prisma as T;
}
