/**
 * EXPLAIN runner implementation for Prisma
 */

import type { PrismaClient } from "@prisma/client";
import type { IExplainRunner } from "../types";

/**
 * Create an EXPLAIN runner for Prisma
 */
export function createExplainRunner(prisma: PrismaClient): IExplainRunner {
  return {
    async runExplain(sql: string, params: unknown[]): Promise<string> {
      try {
        // Execute EXPLAIN ANALYZE
        // SQL has $1, $2, etc. placeholders from extractQueryInfo
        // $queryRawUnsafe supports $1, $2 placeholders when params are passed as separate args
        const explainSql = `EXPLAIN ANALYZE ${sql}`;
        const result: unknown = await Reflect.apply(prisma.$queryRawUnsafe, prisma, [
          explainSql,
          ...params,
        ]);

        // Format result as string
        if (Array.isArray(result)) {
          return JSON.stringify(result, null, 2);
        }

        return String(result);
      } catch (error) {
        return `EXPLAIN failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}
