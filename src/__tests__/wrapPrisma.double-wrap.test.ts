import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { wrapPrisma } from "../wrappers/wrapPrisma";
import { SlowQueryDetector } from "../detector";
import type { ILogger } from "../types";
import { LoggerSink } from "../sinks/loggerSink";

describe("wrapPrisma double wrap", () => {
  it("returns same client when already wrapped", () => {
    const mockLogger: ILogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const detector = new SlowQueryDetector({ warnThresholdMs: 200 }, undefined, [
      new LoggerSink(mockLogger, {}),
    ]);
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $transaction: vi.fn(),
    } as unknown as PrismaClient;

    const once = wrapPrisma(mockPrisma, detector);
    const twice = wrapPrisma(once, detector);
    expect(twice).toBe(once);
  });
});
