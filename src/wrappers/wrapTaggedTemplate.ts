/**
 * Wrap tagged-template SQL calls (e.g. postgres.js `sql`...` / Prisma-style literals)
 */

import type { SlowQueryDetector } from "../detector";
import { extractQueryInfo } from "./extractQueryInfo";

/**
 * Wrap a tagged-template query function with slow query detection.
 *
 * Works for any API shaped like `(parts, ...values) => Promise<unknown>` where `parts`
 * is a `TemplateStringsArray` (standard tagged template semantics).
 */
export function wrapTaggedTemplate<TArgs extends unknown[], TResult>(
  queryFn: (strings: TemplateStringsArray, ...values: TArgs) => Promise<TResult>,
  detector: SlowQueryDetector,
): (strings: TemplateStringsArray, ...values: TArgs) => Promise<TResult> {
  return (strings: TemplateStringsArray, ...values: TArgs) => {
    const { sql, params } = extractQueryInfo(strings, ...(values as unknown[]));
    return detector.executeQuery(() => queryFn(strings, ...values), {
      sql,
      params,
    });
  };
}
