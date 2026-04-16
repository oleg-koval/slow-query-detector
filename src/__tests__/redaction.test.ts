/**
 * Redaction tests
 */

import { describe, it, expect } from "vitest";
import { sanitizeSql, redactParams } from "../redaction";

describe("redaction", () => {
  describe("sanitizeSql", () => {
    it("should collapse whitespace", () => {
      expect(sanitizeSql("SELECT   *   FROM   users")).toBe("SELECT * FROM users");
      expect(sanitizeSql("SELECT\n*\nFROM\nusers")).toBe("SELECT * FROM users");
      expect(sanitizeSql("SELECT\t*\tFROM\tusers")).toBe("SELECT * FROM users");
    });

    it("should trim leading and trailing whitespace", () => {
      expect(sanitizeSql("  SELECT * FROM users  ")).toBe("SELECT * FROM users");
    });

    it("should handle single spaces", () => {
      expect(sanitizeSql("SELECT * FROM users")).toBe("SELECT * FROM users");
    });

    it("should handle empty string", () => {
      expect(sanitizeSql("")).toBe("");
    });
  });

  describe("redactParams", () => {
    it("should redact all params by default", () => {
      expect(redactParams(["value1", "value2", 123])).toEqual([
        "[REDACTED]",
        "[REDACTED]",
        "[REDACTED]",
      ]);
    });

    it("should handle empty params", () => {
      expect(redactParams([])).toEqual([]);
    });

    it("should use custom redactor when provided", () => {
      const customRedactor = (params: unknown[]) =>
        params.map((p) => `***${String(p).slice(0, 2)}***`);
      expect(redactParams(["secret", "password"], customRedactor)).toEqual([
        "***se***",
        "***pa***",
      ]);
    });

    it("should preserve array length", () => {
      const params = ["a", "b", "c", "d", "e"];
      const redacted = redactParams(params);
      expect(redacted).toHaveLength(5);
    });
  });
});
