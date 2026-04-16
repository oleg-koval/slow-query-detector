/**
 * Tests for EXPLAIN runner bugs
 * Specifically tests SQL reconstruction issues
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createExplainRunner } from "../explain/explainRunner";
import type { PrismaClient } from "@prisma/client";

describe("explainRunner bugs", () => {
  let mockPrisma: {
    $queryRawUnsafe: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: vi.fn(),
    };
  });

  it("should handle SQL with $1, $2 placeholders correctly", async () => {
    // This tests the bug: SQL from extractQueryInfo has $1, $2 placeholders
    // But $queryRawUnsafe may not handle them correctly
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ "QUERY PLAN": "Seq Scan" }]);

    const runner = createExplainRunner(mockPrisma as unknown as PrismaClient);

    // SQL with $1 placeholder (as produced by extractQueryInfo)
    const sql = "SELECT * FROM users WHERE id = $1";
    const params = [123];

    await runner.runExplain(sql, params);

    // Verify the call - this may fail if Prisma doesn't handle $1 placeholders
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      "EXPLAIN ANALYZE SELECT * FROM users WHERE id = $1",
      123,
    );

    // The issue: Prisma's $queryRawUnsafe may expect different format
    // PostgreSQL may see literal "$1" string instead of parameter
  });

  it("should handle SQL without placeholders", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const runner = createExplainRunner(mockPrisma as unknown as PrismaClient);

    const sql = "SELECT * FROM users";
    const params: unknown[] = [];

    await runner.runExplain(sql, params);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith("EXPLAIN ANALYZE SELECT * FROM users");
  });

  it("should handle EXPLAIN errors gracefully", async () => {
    mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error("Syntax error"));

    const runner = createExplainRunner(mockPrisma as unknown as PrismaClient);

    const result = await runner.runExplain("SELECT * FROM invalid", []);

    expect(result).toContain("EXPLAIN failed");
    expect(result).toContain("Syntax error");
  });
});
