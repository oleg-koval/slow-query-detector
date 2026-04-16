import type { ILogger } from "./types";

const formatPayload = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return "[Unserializable payload]";
  }
};

/**
 * No-op logger for tests or when logging is disabled.
 */
export const createNoopLogger = (): ILogger => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});

/**
 * Console logger using `console.info` / `console.warn` / `console.error`.
 */
export const createConsoleLogger = (): ILogger => ({
  info: (payload: unknown) => {
    console.info(formatPayload(payload));
  },
  warn: (payload: unknown) => {
    console.warn(formatPayload(payload));
  },
  error: (payload: unknown) => {
    console.error(formatPayload(payload));
  },
});
