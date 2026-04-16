/**
 * Prisma wrapper tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { wrapPrisma } from "../wrappers/wrapPrisma";
import { SlowQueryDetector } from "../detector";
import type { PrismaClient, Prisma } from "@prisma/client";
import type { ILogger } from "../types";
import { LoggerSink } from "../sinks/loggerSink";

describe("wrapPrisma", () => {
  let mockPrisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  };
  let originalQueryRaw: ReturnType<typeof vi.fn>;
  let originalExecuteRaw: ReturnType<typeof vi.fn>;
  let originalTransaction: ReturnType<typeof vi.fn>;
  let mockLogger: ILogger;
  let detector: SlowQueryDetector;

  beforeEach(() => {
    originalQueryRaw = vi.fn().mockResolvedValue([{ id: 1 }]);
    originalExecuteRaw = vi.fn().mockResolvedValue(1);
    originalTransaction = vi.fn();

    mockPrisma = {
      $queryRaw: originalQueryRaw,
      $executeRaw: originalExecuteRaw,
      $transaction: originalTransaction,
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    detector = new SlowQueryDetector({ warnThresholdMs: 200 }, undefined, [
      new LoggerSink(mockLogger, {}),
    ]);
  });

  it("should wrap $queryRaw with template literal", async () => {
    const wrapped = wrapPrisma(mockPrisma as unknown as PrismaClient, detector);

    const result = await wrapped.$queryRaw`SELECT * FROM users WHERE id = ${123}`;

    expect(originalQueryRaw).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  it("should wrap $executeRaw", async () => {
    const wrapped = wrapPrisma(mockPrisma as unknown as PrismaClient, detector);

    const result = await wrapped.$executeRaw`UPDATE users SET name = ${"John"}`;

    expect(originalExecuteRaw).toHaveBeenCalled();
    expect(result).toBe(1);
  });

  it("should instrument queries in transactions", async () => {
    const txQueryRaw = vi.fn().mockResolvedValue([{ id: 1 }]);
    const txClient = {
      $queryRaw: txQueryRaw,
      $executeRaw: vi.fn(),
      $transaction: vi.fn(),
    };

    originalTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txClient);
    });

    const wrapped = wrapPrisma(mockPrisma as unknown as PrismaClient, detector);

    await wrapped.$transaction(async (tx: typeof txClient) => {
      await tx.$queryRaw`SELECT * FROM users`;
    });

    expect(originalTransaction).toHaveBeenCalled();
    expect(txQueryRaw).toHaveBeenCalled();
  });

  it("should handle sequential transactions", async () => {
    const query1 = Promise.resolve([{ id: 1 }]) as unknown as Prisma.PrismaPromise<{ id: number }>;
    const query2 = Promise.resolve([{ id: 2 }]) as unknown as Prisma.PrismaPromise<{ id: number }>;
    const queries = [query1, query2];

    originalTransaction.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const wrapped = wrapPrisma(mockPrisma as unknown as PrismaClient, detector);

    const result = await wrapped.$transaction(
      queries as unknown as Prisma.PrismaPromise<unknown>[],
    );

    expect(originalTransaction).toHaveBeenCalledWith(queries, undefined);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("should forward $queryRaw when the first argument is not a template literal array", async () => {
    const wrapped = wrapPrisma(mockPrisma as unknown as PrismaClient, detector);
    const notTemplate = ["SELECT 1"];
    await (wrapped.$queryRaw as (sql: unknown, ...values: unknown[]) => Promise<unknown>)(
      notTemplate,
    );
    expect(originalQueryRaw).toHaveBeenCalledWith(notTemplate);
  });

  it("should forward $executeRaw when the first argument is not a template literal array", async () => {
    const wrapped = wrapPrisma(mockPrisma as unknown as PrismaClient, detector);
    const notTemplate = ["UPDATE t SET x = 1"];
    await (wrapped.$executeRaw as (sql: unknown, ...values: unknown[]) => Promise<unknown>)(
      notTemplate,
    );
    expect(originalExecuteRaw).toHaveBeenCalledWith(notTemplate);
  });

  it("should return the client unchanged when raw methods are missing", () => {
    const incomplete = { $queryRaw: vi.fn(), $executeRaw: vi.fn() };
    const wrapped = wrapPrisma(incomplete as unknown as PrismaClient, detector);
    expect(wrapped).toBe(incomplete);
  });

  it("should extract SQL and params from template literal", async () => {
    const sinkHandle = vi.fn();
    const mockSink = { handle: sinkHandle };

    const testDetector = new SlowQueryDetector({ warnThresholdMs: 200 }, undefined, [mockSink]);

    const wrapped = wrapPrisma(mockPrisma as unknown as PrismaClient, testDetector);

    await wrapped.$queryRaw`SELECT * FROM users WHERE id = ${123} AND name = ${"John"}`;

    expect(sinkHandle).toHaveBeenCalled();
    const event = sinkHandle.mock.calls[0][0];
    expect(event.sql).toContain("SELECT");
    expect(event.params).toHaveLength(2);
  });
});
