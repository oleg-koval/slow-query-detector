/**
 * Generic query function wrapper
 *
 * WARNING: This function makes assumptions about function signature:
 * - First argument must be SQL (string)
 * - Second argument (optional) must be params (array)
 *
 * For tagged-template SQL (Prisma `$queryRaw`, postgres.js `sql`, etc.), use `wrapTaggedTemplate`.
 * This function is only suitable for simple query functions with the signature:
 * (sql: string, params?: unknown[]) => Promise<unknown>
 */

import type { SlowQueryDetector } from "../detector";

/**
 * Wrap a query function with slow query detection
 *
 * @param queryFn - Function with signature (sql: string, params?: unknown[]) => Promise<unknown>
 * @param detector - Slow query detector instance
 * @returns Wrapped function with same signature
 */
export function wrapQueryFn(
  queryFn: (sql: string, params?: unknown[]) => Promise<unknown>,
  detector: SlowQueryDetector,
): typeof queryFn {
  return async (sql: string, params?: unknown[]) => {
    return detector.executeQuery(() => queryFn(sql, params), {
      sql,
      params: params ?? [],
    });
  };
}
