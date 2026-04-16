/**
 * Prisma client wrapper for slow query detection
 */

import type { PrismaClient } from "@prisma/client";
import type { SlowQueryDetector } from "../detector";
import { extractQueryInfo } from "./extractQueryInfo";

const instrumentedClients = new WeakMap<object, true>();

const isInstrumented = (client: object): boolean => instrumentedClients.has(client);

const markInstrumented = (client: object): void => {
  instrumentedClients.set(client, true);
};

type RawMethodsClient = Pick<PrismaClient, "$queryRaw" | "$executeRaw" | "$transaction">;

const isRawMethodsClient = (value: unknown): value is RawMethodsClient & object =>
  typeof value === "object" &&
  value !== null &&
  "$queryRaw" in value &&
  "$executeRaw" in value &&
  "$transaction" in value;

const isTemplateStringsArray = (value: unknown): value is TemplateStringsArray =>
  Array.isArray(value) && "raw" in value && Array.isArray(Reflect.get(value, "raw"));

function instrumentRawMethods(
  client: RawMethodsClient & object,
  detector: SlowQueryDetector,
): void {
  if (isInstrumented(client)) {
    return;
  }

  markInstrumented(client);

  const originalQueryRaw = client.$queryRaw.bind(client);
  const originalExecuteRaw = client.$executeRaw.bind(client);
  const originalTransaction = client.$transaction.bind(client);

  client.$queryRaw = (...args: Parameters<typeof originalQueryRaw>) => {
    const [sql, ...values] = args;
    if (!isTemplateStringsArray(sql)) {
      return originalQueryRaw(...args);
    }
    const { sql: sqlString, params } = extractQueryInfo(sql, ...values);
    return detector.executeQuery(() => originalQueryRaw(...args), {
      sql: sqlString,
      params,
    });
  };

  client.$executeRaw = (...args: Parameters<typeof originalExecuteRaw>) => {
    const [sql, ...values] = args;
    if (!isTemplateStringsArray(sql)) {
      return originalExecuteRaw(...args);
    }
    const { sql: sqlString, params } = extractQueryInfo(sql, ...values);
    return detector.executeQuery(() => originalExecuteRaw(...args), {
      sql: sqlString,
      params,
    });
  };

  client.$transaction = (
    first: Parameters<typeof originalTransaction>[0],
    second?: Parameters<typeof originalTransaction>[1],
  ) => {
    if (typeof first === "function") {
      const runCallback = first;
      return originalTransaction(async (tx: unknown) => {
        if (isRawMethodsClient(tx) && !isInstrumented(tx)) {
          instrumentRawMethods(tx, detector);
        }
        return Reflect.apply(runCallback, undefined, [tx]);
      }, second);
    }
    return originalTransaction(first, second);
  };
}

/**
 * Wrap Prisma client with slow query detection
 * Prevents double-wrapping by tracking instrumented client instances
 */
export function wrapPrisma<T extends PrismaClient>(prisma: T, detector: SlowQueryDetector): T {
  if (!isRawMethodsClient(prisma)) {
    return prisma;
  }
  if (isInstrumented(prisma)) {
    return prisma;
  }
  instrumentRawMethods(prisma, detector);
  return prisma;
}
