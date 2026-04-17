import { describe, expect, it } from "vitest";
import { getDbContext, resolveDetectorContext, runWithDbContext } from "../context";

describe("slowQueryDetector context", () => {
  it("provides context within run scope", async () => {
    const result = await runWithDbContext({ requestId: "req-1", userId: "user-1" }, async () => {
      return getDbContext();
    });
    expect(result).toEqual({ requestId: "req-1", userId: "user-1" });
  });

  it("returns empty context outside scope", () => {
    expect(getDbContext()).toEqual({});
  });

  it("resolveDetectorContext returns empty when provider missing", () => {
    expect(resolveDetectorContext(undefined)).toEqual({});
  });

  it("resolveDetectorContext swallows provider errors", () => {
    const provider = {
      getContext: (): never => {
        throw new Error("boom");
      },
    };
    expect(resolveDetectorContext(provider)).toEqual({});
  });
});
