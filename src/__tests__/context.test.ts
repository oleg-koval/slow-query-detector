import { describe, expect, it } from "vitest";
import { getDbContext, runWithDbContext } from "../context";

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
});
