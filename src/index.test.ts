import { describe, expect, it } from "vitest";
import { getVersion, type QuerydVersion } from "./index";

describe("getVersion", () => {
  it("returns package identity", () => {
    const v = getVersion();
    expect(v).toEqual({
      name: "queryd",
      version: "0.1.0",
    });
    expect(v.name).toBe("queryd");
    expect(v.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("returns a fresh object each call", () => {
    expect(getVersion()).not.toBe(getVersion());
  });

  it("matches QuerydVersion shape for consumers", () => {
    const v: QuerydVersion = getVersion();
    expect(JSON.parse(JSON.stringify(v))).toEqual({
      name: "queryd",
      version: "0.1.0",
    });
  });
});
