import { describe, expect, it, vi } from "vitest";
import { createConsoleLogger, createNoopLogger } from "../logger";

describe("queryd logger", () => {
  it("noop logger accepts payloads without throwing", () => {
    const logger = createNoopLogger();
    logger.info("test");
    logger.warn({ a: 1 });
    logger.error(new Error("x"));
    expect(logger).toBeDefined();
  });

  it("console logger forwards formatted payloads", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createConsoleLogger();
    logger.info({ event: "db.query" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("console logger uses warn and error", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createConsoleLogger();
    logger.warn("w");
    logger.error("e");
    expect(warnSpy).toHaveBeenCalledWith("w");
    expect(errSpy).toHaveBeenCalledWith("e");
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });

  it("console logger handles unserializable payloads", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createConsoleLogger();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    logger.info(circular);
    expect(spy).toHaveBeenCalledWith("[Unserializable payload]");
    spy.mockRestore();
  });
});
