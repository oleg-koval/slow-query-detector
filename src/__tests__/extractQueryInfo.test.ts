import { describe, expect, it } from "vitest";
import { extractQueryInfo } from "../wrappers/extractQueryInfo";

describe("extractQueryInfo", () => {
  it("returns empty sql for empty template literal", () => {
    const empty = { length: 0, raw: [] } as unknown as TemplateStringsArray;
    expect(extractQueryInfo(empty)).toEqual({ sql: "", params: [] });
  });
});
