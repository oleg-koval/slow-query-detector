/**
 * Logger sink tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoggerSink } from "../sinks/loggerSink";
import type { QueryEvent, ILogger } from "../types";

describe("loggerSink", () => {
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  it("should log error events with logger.error", () => {
    const sink = new LoggerSink(mockLogger, {});
    const event: QueryEvent = {
      event: "db.query",
      subtype: "error",
      durationMs: 100,
      timestamp: new Date().toISOString(),
      sql: "SELECT * FROM users",
      params: [],
      errorName: "Error",
      errorMessage: "Database error",
    };

    sink.handle(event);

    expect(mockLogger.error).toHaveBeenCalledWith(event);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it("should log slow events with logger.warn", () => {
    const sink = new LoggerSink(mockLogger, {});
    const event: QueryEvent = {
      event: "db.query",
      subtype: "slow",
      durationMs: 300,
      timestamp: new Date().toISOString(),
      sql: "SELECT * FROM users",
      params: [],
    };

    sink.handle(event);

    expect(mockLogger.warn).toHaveBeenCalledWith(event);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it("should log very_slow events with logger.warn", () => {
    const sink = new LoggerSink(mockLogger, {});
    const event: QueryEvent = {
      event: "db.query",
      subtype: "very_slow",
      durationMs: 2000,
      timestamp: new Date().toISOString(),
      sql: "SELECT * FROM users",
      params: [],
    };

    sink.handle(event);

    expect(mockLogger.warn).toHaveBeenCalledWith(event);
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("should sample normal events based on sampleRateNormal", () => {
    const sink = new LoggerSink(mockLogger, { sampleRateNormal: 1.0 });
    const event: QueryEvent = {
      event: "db.query",
      subtype: "normal",
      durationMs: 50,
      timestamp: new Date().toISOString(),
      sql: "SELECT * FROM users",
      params: [],
    };

    sink.handle(event);

    expect(mockLogger.info).toHaveBeenCalledWith(event);
  });

  it("should not log normal events when sampleRateNormal is 0", () => {
    const sink = new LoggerSink(mockLogger, { sampleRateNormal: 0.0 });
    const event: QueryEvent = {
      event: "db.query",
      subtype: "normal",
      durationMs: 50,
      timestamp: new Date().toISOString(),
      sql: "SELECT * FROM users",
      params: [],
    };

    sink.handle(event);

    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
