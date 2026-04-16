import { describe, expect, it } from "vitest";
import { getVersion } from "./index";

describe("getVersion", () => {
  it("returns package identity", () => {
    expect(getVersion()).toEqual({
      name: "queryd",
      version: "0.1.0",
    });
  });
});
