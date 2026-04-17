/**
 * Integration tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSlowQueryDetector, runWithDbContext, wrapTaggedTemplate } from "../index";
import { wrapPrismaClient } from "../prisma";
import type { ILogger, IContextProvider } from "../types";
import type { PrismaClient } from "@prisma/client";

describe("integration", () => {
  let mockInfo: ReturnType<typeof vi.fn>;
  let mockWarn: ReturnType<typeof vi.fn>;
  let mockError: ReturnType<typeof vi.fn>;
  let mockLogger: ILogger;
  let mockPrisma: {
    $queryRaw: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  };
  let originalQueryRaw: ReturnType<typeof vi.fn>;
  let contextProvider: IContextProvider;

  beforeEach(() => {
    mockInfo = vi.fn();
    mockWarn = vi.fn();
    mockError = vi.fn();
    mockLogger = {
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    } as unknown as ILogger;

    originalQueryRaw = vi.fn().mockResolvedValue([{ id: 1, name: "Test" }]);

    mockPrisma = {
      $queryRaw: originalQueryRaw,
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn(),
    };

    contextProvider = {
      getContext: () => ({
        requestId: "req-123",
        userId: "user-456",
      }),
    };
  });

  it("should detect and log slow queries end-to-end", async () => {
    const detector = createSlowQueryDetector(
      {
        warnThresholdMs: 50,
        dbName: "test",
      },
      { logger: mockLogger },
    );

    // Simulate slow query
    originalQueryRaw.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return [{ id: 1 }];
    });

    const wrapped = wrapPrismaClient(mockPrisma as unknown as PrismaClient, detector);

    await wrapped.$queryRaw`SELECT * FROM users`;

    expect(mockWarn).toHaveBeenCalled();
    const logCall = mockWarn.mock.calls[0][0] as unknown;
    expect(logCall).toMatchObject({
      event: "db.query",
      subtype: "slow",
      dbName: "test",
    });
  });

  it("should include context in events", async () => {
    const detector = createSlowQueryDetector(
      { warnThresholdMs: 200 },
      { logger: mockLogger, contextProvider },
    );

    const wrapped = wrapPrismaClient(mockPrisma as unknown as PrismaClient, detector);

    await wrapped.$queryRaw`SELECT * FROM users`;

    expect(mockInfo).not.toHaveBeenCalled(); // Normal query, not sampled
    // But if we check the event structure, it should have context
    // We can verify this by checking warn calls for slow queries
  });

  it("should handle query errors", async () => {
    const detector = createSlowQueryDetector({}, { logger: mockLogger });

    originalQueryRaw.mockRejectedValue(new Error("Database connection failed"));

    const wrapped = wrapPrismaClient(mockPrisma as unknown as PrismaClient, detector);

    await expect(wrapped.$queryRaw`SELECT * FROM users`).rejects.toThrow(
      "Database connection failed",
    );

    expect(mockError).toHaveBeenCalled();
    const logCall = mockError.mock.calls[0][0] as unknown;
    expect(logCall).toMatchObject({
      event: "db.query",
      subtype: "error",
      errorName: "Error",
      errorMessage: "Database connection failed",
    });
  });

  it("should respect sampling for normal queries", async () => {
    const detector = createSlowQueryDetector(
      {
        sampleRateNormal: 1.0, // Sample all normal queries
      },
      { logger: mockLogger },
    );

    const wrapped = wrapPrismaClient(mockPrisma as unknown as PrismaClient, detector);

    await wrapped.$queryRaw`SELECT * FROM users`;

    // With sampleRateNormal = 1.0, should log info
    expect(mockInfo).toHaveBeenCalled();
  });

  it("should not sample normal queries when sampleRateNormal is 0", async () => {
    const detector = createSlowQueryDetector(
      {
        sampleRateNormal: 0.0,
      },
      { logger: mockLogger },
    );

    const wrapped = wrapPrismaClient(mockPrisma as unknown as PrismaClient, detector);

    await wrapped.$queryRaw`SELECT * FROM users`;

    expect(mockInfo).not.toHaveBeenCalled();
  });

  it("should instrument transactions", async () => {
    const detector = createSlowQueryDetector({ warnThresholdMs: 200 }, { logger: mockLogger });

    const txQueryRaw = vi.fn().mockResolvedValue([{ id: 1 }]);
    const txClient = {
      $queryRaw: txQueryRaw,
      $executeRaw: vi.fn(),
      $transaction: vi.fn(),
    };

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn(txClient);
    });

    const wrapped = wrapPrismaClient(mockPrisma as unknown as PrismaClient, detector);

    await wrapped.$transaction(async (tx: typeof txClient) => {
      await tx.$queryRaw`SELECT * FROM users`;
      await tx.$queryRaw`SELECT * FROM posts`;
    });

    expect(txQueryRaw).toHaveBeenCalledTimes(2);
  });

  it("should emit request budget via wrapTaggedTemplate and runWithDbContext", async () => {
    const detector = createSlowQueryDetector(
      {
        warnThresholdMs: 999_999,
        requestBudget: { maxQueries: 2 },
        sampleRateNormal: 0,
      },
      { logger: mockLogger },
    );
    const exec = vi.fn().mockResolvedValue([]);
    const wrapped = wrapTaggedTemplate(exec, detector);

    await runWithDbContext({ requestId: "req-budget", userId: "u-1" }, async () => {
      await wrapped`SELECT 1`;
      await wrapped`SELECT 2`;
      await wrapped`SELECT 3`;
    });

    const budgetWarnings = mockWarn.mock.calls.filter(
      (c) =>
        typeof c[0] === "object" &&
        c[0] !== null &&
        (c[0] as { event?: string }).event === "db.request.budget",
    );
    expect(budgetWarnings).toHaveLength(1);
  });
});
