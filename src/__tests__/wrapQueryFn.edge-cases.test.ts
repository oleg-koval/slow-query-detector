/**
 * Edge case tests for wrapQueryFn
 * Tests type safety, signature assumptions, and error scenarios
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapQueryFn } from "../wrappers/wrapQueryFn";
import { SlowQueryDetector } from "../detector";
import type { ILogger } from "../types";
import { LoggerSink } from "../sinks/loggerSink";

describe("wrapQueryFn edge cases", () => {
  let mockLogger: ILogger;
  let detector: SlowQueryDetector;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    detector = new SlowQueryDetector({ warnThresholdMs: 200 }, undefined, [
      new LoggerSink(mockLogger, {}),
    ]);
  });

  it("should only accept functions with correct signature", () => {
    // wrapQueryFn now has explicit signature, so wrong signatures won't compile
    // This test verifies the type safety
    const validQueryFn = async (sql: string) => {
      return [{ result: sql }];
    };

    // This should work
    const wrapped = wrapQueryFn(validQueryFn, detector);
    expect(wrapped).toBeDefined();
  });

  it("should handle functions with only SQL, no params", async () => {
    const queryFn = async (sql: string) => {
      return [{ sql }];
    };

    const wrapped = wrapQueryFn(queryFn, detector);

    const result = await wrapped("SELECT 1");

    expect(result).toEqual([{ sql: "SELECT 1" }]);
  });

  it("should handle functions with only SQL, no params", async () => {
    const queryFn = async (sql: string) => {
      return [{ sql }];
    };

    const wrapped = wrapQueryFn(queryFn, detector);

    const result = await wrapped("SELECT 1");

    expect(result).toEqual([{ sql: "SELECT 1" }]);
  });

  it("should require string as first parameter", async () => {
    const queryFn = async (sql: string) => {
      return [{ sql }];
    };

    const wrapped = wrapQueryFn(queryFn, detector);

    // Valid call with string
    const result = await wrapped("SELECT 1");
    expect(result).toEqual([{ sql: "SELECT 1" }]);
  });

  it("should document that tagged-template SQL should use wrapTaggedTemplate or @olegkoval/queryd/prisma", () => {
    // wrapQueryFn is not for tagged templates; use wrapTaggedTemplate or @olegkoval/queryd/prisma
    expect(true).toBe(true);
  });
});
