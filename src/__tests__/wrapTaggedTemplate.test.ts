import { describe, it, expect, vi } from "vitest";
import { createSlowQueryDetector } from "../index";
import { createNoopLogger } from "../logger";
import { wrapTaggedTemplate } from "../wrappers/wrapTaggedTemplate";

describe("wrapTaggedTemplate", () => {
  it("instruments tagged-template calls and preserves result", async () => {
    const sink = { handle: vi.fn() };
    const detector = createSlowQueryDetector(
      {
        warnThresholdMs: 0,
        sampleRateNormal: 1,
        sampleRateSlow: 1,
        paramsRedactor: (params) => params,
      },
      { logger: createNoopLogger(), sinks: [sink] },
    );

    const base = async (strings: TemplateStringsArray, a: number, b: string) => {
      void strings;
      void a;
      void b;
      return ["row"];
    };

    const wrapped = wrapTaggedTemplate(base, detector);
    const out = await wrapped`SELECT ${1} AS n, ${"x"} AS s`;

    expect(out).toEqual(["row"]);
    expect(sink.handle).toHaveBeenCalled();
    const ev = sink.handle.mock.calls[0][0] as { sql: string; params: unknown[] };
    expect(ev.sql).toContain("$1");
    expect(ev.sql).toContain("$2");
    expect(ev.params).toEqual([1, "x"]);
  });
});
