/**
 * Classifier tests
 */

import { describe, it, expect } from "vitest";
import { classifyQuery } from "../classifier";

describe("classifier", () => {
  it("should classify normal queries", () => {
    expect(classifyQuery(50, { warnThresholdMs: 200, errorThresholdMs: 1000 })).toBe("normal");
    expect(classifyQuery(199, { warnThresholdMs: 200, errorThresholdMs: 1000 })).toBe("normal");
  });

  it("should classify slow queries", () => {
    expect(classifyQuery(200, { warnThresholdMs: 200, errorThresholdMs: 1000 })).toBe("slow");
    expect(classifyQuery(500, { warnThresholdMs: 200, errorThresholdMs: 1000 })).toBe("slow");
    expect(classifyQuery(999, { warnThresholdMs: 200, errorThresholdMs: 1000 })).toBe("slow");
  });

  it("should classify very slow queries", () => {
    expect(classifyQuery(1000, { warnThresholdMs: 200, errorThresholdMs: 1000 })).toBe("very_slow");
    expect(classifyQuery(2000, { warnThresholdMs: 200, errorThresholdMs: 1000 })).toBe("very_slow");
  });

  it("should use default thresholds when not provided", () => {
    expect(classifyQuery(50, {})).toBe("normal");
    expect(classifyQuery(200, {})).toBe("slow");
    expect(classifyQuery(1000, {})).toBe("very_slow");
  });

  it("should handle custom thresholds", () => {
    expect(classifyQuery(100, { warnThresholdMs: 50, errorThresholdMs: 200 })).toBe("slow");
    expect(classifyQuery(250, { warnThresholdMs: 50, errorThresholdMs: 200 })).toBe("very_slow");
  });
});
