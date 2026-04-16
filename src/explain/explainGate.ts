/**
 * Gate for controlling EXPLAIN execution
 * - Production guard
 * - Threshold check
 * Note: Throttle is handled by ExplainThrottle class (per-instance)
 */

import type { SlowQueryDetectorConfig } from "../types";
import { DEFAULT_CONFIG } from "../config";
import type { ExplainThrottle } from "./throttle";

/**
 * Determine if EXPLAIN should run for a query
 * (Throttle check is done separately via ExplainThrottle instance)
 */
export function shouldRunExplain(
  durationMs: number,
  config: SlowQueryDetectorConfig,
  throttle?: ExplainThrottle,
): boolean {
  // Check if EXPLAIN is enabled
  if (!(config.enableExplain ?? DEFAULT_CONFIG.enableExplain)) {
    return false;
  }

  // Production guard
  if (
    process.env.NODE_ENV === "production" &&
    !(config.allowExplainInProd ?? DEFAULT_CONFIG.allowExplainInProd)
  ) {
    return false;
  }

  // Threshold check
  const explainThreshold = config.explainThresholdMs ?? DEFAULT_CONFIG.explainThresholdMs;
  if (durationMs < explainThreshold) {
    return false;
  }

  // Throttle check (per-instance, thread-safe)
  // Throttle should always be provided when called from detector
  // But handle undefined gracefully for direct calls (tests, etc.)
  if (throttle) {
    if (!throttle.shouldAllow()) {
      return false;
    }
  }
  // If throttle is undefined, allow (but this should not happen in production)
  // Detector always provides throttle instance

  return true;
}

// Re-export for backward compatibility (tests)
export { ExplainThrottle } from "./throttle";
