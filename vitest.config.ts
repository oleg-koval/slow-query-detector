import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts"],
      // Phase 1 lands ~97–98% lines; push toward 100% in dedicated hardening (plan Task 6).
      thresholds: {
        lines: 97,
        functions: 94,
        branches: 89,
        statements: 97,
      },
    },
  },
});
