/**
 * Query classification based on duration thresholds
 */

import type { QuerySubtype, SlowQueryDetectorConfig } from "./types";
import { DEFAULT_CONFIG } from "./config";

/**
 * Classify query based on duration and thresholds
 */
export function classifyQuery(durationMs: number, config: SlowQueryDetectorConfig): QuerySubtype {
  const errorThreshold = config.errorThresholdMs ?? DEFAULT_CONFIG.errorThresholdMs;
  const warnThreshold = config.warnThresholdMs ?? DEFAULT_CONFIG.warnThresholdMs;

  if (durationMs >= errorThreshold) {
    return "very_slow";
  }

  if (durationMs >= warnThreshold) {
    return "slow";
  }

  return "normal";
}
