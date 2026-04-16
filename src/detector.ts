/**
 * Core slow query detector orchestrator
 */

import type {
  QueryMetadata,
  QuerySubtype,
  SlowQueryDetectorConfig,
  IContextProvider,
  IEventSink,
  IExplainRunner,
} from "./types";
import { startTimer } from "./timer";
import { classifyQuery } from "./classifier";
import { createQueryEvent } from "./eventFactory";
import { shouldRunExplain } from "./explain/explainGate";
import { ExplainThrottle } from "./explain/throttle";

/**
 * Slow query detector
 */
export class SlowQueryDetector {
  private readonly explainThrottle: ExplainThrottle;

  constructor(
    public readonly config: SlowQueryDetectorConfig,
    public readonly contextProvider?: IContextProvider,
    public readonly sinks: IEventSink[] = [],
    public explainRunner?: IExplainRunner,
  ) {
    this.explainThrottle = new ExplainThrottle();
  }

  /**
   * Execute a query with instrumentation
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    metadata: {
      sql: string;
      params: unknown[];
      queryName?: string;
    },
  ): Promise<T> {
    const stopTimer = startTimer();
    let result: T;
    let error: Error | undefined;
    let rowCount: number | undefined;

    try {
      result = await queryFn();

      // Try to extract row count from various result shapes
      if (Array.isArray(result)) {
        rowCount = result.length;
      } else if (
        result &&
        typeof result === "object" &&
        "count" in result &&
        typeof (result as { count: unknown }).count === "number"
      ) {
        // Handle Prisma count results: { count: number }
        rowCount = (result as { count: number }).count;
      }

      return result;
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      throw error; // Throw wrapped error so event metadata matches
    } finally {
      const durationMs = stopTimer();

      const queryMetadata: QueryMetadata = {
        sql: metadata.sql,
        params: metadata.params,
        durationMs,
        rowCount,
        queryName: metadata.queryName,
        error,
      };

      const subtype: QuerySubtype = error ? "error" : classifyQuery(durationMs, this.config);

      const event = createQueryEvent(queryMetadata, subtype, this.config, this.contextProvider);

      // Send to all sinks with error handling
      for (const sink of this.sinks) {
        try {
          sink.handle(event);
        } catch {
          // Don't fail query if sink fails - log but continue
          // Sink errors should not break query execution
        }
      }

      // Optionally run EXPLAIN (async, don't await to avoid blocking)
      if (
        !error &&
        shouldRunExplain(durationMs, this.config, this.explainThrottle) &&
        this.explainRunner
      ) {
        this.explainRunner
          .runExplain(metadata.sql, metadata.params)
          .then(() => {
            // EXPLAIN result could be logged via sinks if needed
          })
          .catch((explainError) => {
            // Log EXPLAIN failures to sinks (but don't fail query)
            for (const sink of this.sinks) {
              try {
                sink.handle({
                  event: "db.query",
                  subtype: "error",
                  durationMs: 0,
                  timestamp: new Date().toISOString(),
                  sql: `EXPLAIN ${metadata.sql}`,
                  params: [],
                  errorName: explainError instanceof Error ? explainError.name : "Error",
                  errorMessage:
                    explainError instanceof Error ? explainError.message : String(explainError),
                });
              } catch {
                // Ignore sink errors
              }
            }
          });
      }
    }
  }
}
