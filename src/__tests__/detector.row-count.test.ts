/**
 * Tests for row count extraction
 * Tests various result shapes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlowQueryDetector } from "../detector";
import type { QueryEvent, IEventSink } from "../types";

describe("detector row count extraction", () => {
  let sinkHandle: ReturnType<typeof vi.fn>;
  let mockSink: IEventSink;

  beforeEach(() => {
    sinkHandle = vi.fn();
    mockSink = { handle: sinkHandle } as unknown as IEventSink;
  });

  it("should extract row count from array results", async () => {
    const detector = new SlowQueryDetector({}, undefined, [mockSink]);

    await detector.executeQuery(async () => [{ id: 1 }, { id: 2 }, { id: 3 }], {
      sql: "SELECT * FROM users",
      params: [],
    });

    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.rowCount).toBe(3);
  });

  it("should not extract row count from non-array results", async () => {
    const detector = new SlowQueryDetector({}, undefined, [mockSink]);

    await detector.executeQuery(async () => ({ id: 1, name: "Test" }), {
      sql: "SELECT * FROM users WHERE id = 1",
      params: [],
    });

    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.rowCount).toBeUndefined();
  });

  it("should not extract row count from number results", async () => {
    const detector = new SlowQueryDetector({}, undefined, [mockSink]);

    await detector.executeQuery(async () => 5, {
      sql: "SELECT COUNT(*) FROM users",
      params: [],
    });

    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.rowCount).toBeUndefined();
  });

  it("should extract row count from Prisma-style count result", async () => {
    const detector = new SlowQueryDetector({}, undefined, [mockSink]);

    await detector.executeQuery(async () => ({ count: 42 }), {
      sql: "SELECT COUNT(*) FROM users",
      params: [],
    });

    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.rowCount).toBe(42);
  });

  it("should handle empty array results", async () => {
    const detector = new SlowQueryDetector({}, undefined, [mockSink]);

    await detector.executeQuery(async () => [], {
      sql: "SELECT * FROM users WHERE id = 999",
      params: [],
    });

    const event = sinkHandle.mock.calls[0][0] as QueryEvent;
    expect(event.rowCount).toBe(0);
  });
});
