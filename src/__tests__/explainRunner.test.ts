/**
 * Explain runner tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createExplainRunner } from "../explain/explainRunner";
import type { PrismaClient } from "@prisma/client";

describe("explainRunner", () => {
  let mockPrisma: {
    $queryRawUnsafe: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: vi.fn(),
    };
  });

  it("should execute EXPLAIN ANALYZE", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ "QUERY PLAN": "Seq Scan" }]);

    const runner = createExplainRunner(mockPrisma as unknown as PrismaClient);
    const result = await runner.runExplain("SELECT * FROM users", []);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      "EXPLAIN ANALYZE SELECT * FROM users",
      ...[],
    );
    expect(result).toContain("Seq Scan");
  });

  it("should format array results as JSON", async () => {
    const explainResult = [{ "QUERY PLAN": "Index Scan" }, { "QUERY PLAN": "Seq Scan" }];
    mockPrisma.$queryRawUnsafe.mockResolvedValue(explainResult);

    const runner = createExplainRunner(mockPrisma as unknown as PrismaClient);
    const result = await runner.runExplain("SELECT * FROM users", ["param1"]);

    expect(JSON.parse(result)).toEqual(explainResult);
  });

  it("should handle errors gracefully", async () => {
    mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error("EXPLAIN failed"));

    const runner = createExplainRunner(mockPrisma as unknown as PrismaClient);
    const result = await runner.runExplain("SELECT * FROM users", []);

    expect(result).toContain("EXPLAIN failed");
  });

  it("should format scalar results with String()", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue(42);

    const runner = createExplainRunner(mockPrisma as unknown as PrismaClient);
    const result = await runner.runExplain("SELECT 1", []);

    expect(result).toBe("42");
  });

  it("should pass params to query", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const runner = createExplainRunner(mockPrisma as unknown as PrismaClient);
    await runner.runExplain("SELECT * FROM users WHERE id = ?", ["user-123"]);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      "EXPLAIN ANALYZE SELECT * FROM users WHERE id = ?",
      "user-123",
    );
  });
});
