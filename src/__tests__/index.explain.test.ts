import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createSlowQueryDetector } from "../index";
import { wrapPrismaClient } from "../prisma";

describe("wrapPrismaClient explain wiring", () => {
  it("creates explain runner when enableExplain is true", () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const detector = createSlowQueryDetector(
      { enableExplain: true, explainThresholdMs: 1 },
      { logger },
    );
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: vi.fn().mockResolvedValue(0),
      $transaction: vi.fn(),
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    } as unknown as PrismaClient;

    wrapPrismaClient(prisma, detector);

    expect(detector.explainRunner).toBeDefined();
  });
});
