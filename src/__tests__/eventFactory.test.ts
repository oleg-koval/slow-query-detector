/**
 * Event factory tests
 */

import { describe, it, expect } from "vitest";
import { createQueryEvent } from "../eventFactory";
import type { QueryMetadata, IContextProvider } from "../types";

describe("eventFactory", () => {
  const baseMetadata: QueryMetadata = {
    sql: "SELECT * FROM users",
    params: ["param1", "param2"],
    durationMs: 100,
    rowCount: 5,
  };

  it("should create normal query event", () => {
    const event = createQueryEvent(baseMetadata, "normal", { dbName: "test" });

    expect(event.event).toBe("db.query");
    expect(event.subtype).toBe("normal");
    expect(event.durationMs).toBe(100);
    expect(event.sql).toBe("SELECT * FROM users");
    expect(event.params).toEqual(["[REDACTED]", "[REDACTED]"]);
    expect(event.rowCount).toBe(5);
    expect(event.dbName).toBe("test");
    expect(event.timestamp).toBeDefined();
  });

  it("should include context from provider", () => {
    const contextProvider: IContextProvider = {
      getContext: () => ({
        requestId: "req-123",
        userId: "user-456",
      }),
    };

    const event = createQueryEvent(baseMetadata, "normal", {}, contextProvider);

    expect(event.requestId).toBe("req-123");
    expect(event.userId).toBe("user-456");
  });

  it("should handle error events", () => {
    const error = new Error("Database error");
    const metadata: QueryMetadata = {
      ...baseMetadata,
      error,
    };

    const event = createQueryEvent(metadata, "error", { includeStackTrace: false });

    expect(event.subtype).toBe("error");
    expect(event.errorName).toBe("Error");
    expect(event.errorMessage).toBe("Database error");
    expect(event.stackTrace).toBeUndefined();
  });

  it("should include stack trace when configured", () => {
    const error = new Error("Database error");
    error.stack = "Error: Database error\n    at test.js:1:1";
    const metadata: QueryMetadata = {
      ...baseMetadata,
      error,
    };

    const event = createQueryEvent(metadata, "error", { includeStackTrace: true });

    expect(event.stackTrace).toBe("Error: Database error\n    at test.js:1:1");
  });

  it("should sanitize SQL", () => {
    const metadata: QueryMetadata = {
      sql: "SELECT   *   FROM   users",
      params: [],
      durationMs: 100,
    };

    const event = createQueryEvent(metadata, "normal", {});

    expect(event.sql).toBe("SELECT * FROM users");
  });

  it("should include query name", () => {
    const metadata: QueryMetadata = {
      ...baseMetadata,
      queryName: "getUserById",
    };

    const event = createQueryEvent(metadata, "normal", {});

    expect(event.queryName).toBe("getUserById");
  });
});
