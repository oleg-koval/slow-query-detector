/**
 * Configuration types and defaults for slow query detector
 */

import type { SlowQueryDetectorConfig } from "./types";

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<
  Omit<SlowQueryDetectorConfig, "dbName" | "paramsRedactor" | "queryName" | "requestBudget">
> = {
  warnThresholdMs: 200,
  errorThresholdMs: 1000,
  sampleRateNormal: 0.0,
  sampleRateSlow: 1.0,
  includeStackTrace: false,
  enableExplain: false,
  allowExplainInProd: false,
  explainThresholdMs: 5000,
};
