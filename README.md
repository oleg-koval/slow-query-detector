<p align="left">
  <img src="./docs/assets/queryd-wordmark-dark.svg" alt="queryd" width="240" height="62" />
</p>

[![CI](https://img.shields.io/github/actions/workflow/status/oleg-koval/slow-query-detector/ci-release.yml?branch=main&logo=github&label=ci)](https://github.com/oleg-koval/slow-query-detector/actions/workflows/ci-release.yml?query=branch%3Amain)
[![Coverage](https://img.shields.io/coverallsCoverage/github/oleg-koval/slow-query-detector?branch=main&logo=coveralls)](https://coveralls.io/github/oleg-koval/slow-query-detector)
[![npm version](https://img.shields.io/npm/v/@olegkoval%2Fqueryd.svg?logo=npm&label=npm)](https://www.npmjs.com/package/@olegkoval/queryd)
[![npm downloads](https://img.shields.io/npm/dm/@olegkoval%2Fqueryd.svg?logo=npm&label=downloads)](https://www.npmjs.com/package/@olegkoval/queryd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/@olegkoval%2Fqueryd.svg?logo=node.js&label=node)](https://nodejs.org/)
[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-5eead4)](https://oleg-koval.github.io/slow-query-detector/)

**queryd** is a database query latency detector for Node.js: **driver-agnostic** hooks (`wrapQueryFn`, `wrapTaggedTemplate`, `SlowQueryDetector.executeQuery`), optional **Prisma** integration behind `@olegkoval/queryd/prisma`, sampling, optional **per-request query budgets**, optional `EXPLAIN ANALYZE`, and pluggable sinks.

Project site: [oleg-koval.github.io/slow-query-detector](https://oleg-koval.github.io/slow-query-detector/).

## Install

```bash
npm install @olegkoval/queryd
```

Add `@prisma/client` only if you use the Prisma entry (see below).

## Usage (any stack)

`SlowQueryDetector.executeQuery` runs your callback and emits structured events (`QueryEvent` for each query, and optionally `RequestBudgetViolationEvent` — see [Request budgets](#request-budgets-per-requestid)). Wrappers cover common shapes:

- **`wrapQueryFn`** — `(sql: string, params?) => Promise<unknown>` (raw clients, thin DB helpers).
- **`wrapTaggedTemplate`** — tagged template `(strings, ...values) => Promise<unknown>` (e.g. **postgres.js** `sql`, same literal shape as Prisma `$queryRaw`).
- **`extractQueryInfo`** — build `$1…$n` SQL + params from a `TemplateStringsArray` if you wire a custom executor.

### postgres.js (tagged template + request scope)

Use **`runWithDbContext`** so each HTTP request (or job) gets a stable **`requestId`**; **`createSlowQueryDetector`** defaults `contextProvider` to **`getDbContext()`**, so you usually do **not** pass `contextProvider` unless you merge ALS with your own source.

```ts
import postgres from "postgres";
import {
  createSlowQueryDetector,
  wrapTaggedTemplate,
  createConsoleLogger,
  runWithDbContext,
} from "@olegkoval/queryd";

const sql = postgres(process.env.DATABASE_URL!);
const detector = createSlowQueryDetector(
  {
    warnThresholdMs: 200,
    dbName: "primary",
    requestBudget: { maxQueries: 80, maxTotalDurationMs: 2_000 },
  },
  { logger: createConsoleLogger() },
);
const instrumentedSql = wrapTaggedTemplate(sql, detector);

await runWithDbContext({ requestId: "req-abc", userId: "user-42" }, async () => {
  await instrumentedSql`select ${1}::int`;
  await instrumentedSql`select ${2}::int`;
});
```

### `wrapQueryFn` (string SQL)

```ts
import { createSlowQueryDetector, wrapQueryFn, createConsoleLogger, runWithDbContext } from "@olegkoval/queryd";

const rawQuery = async (sql: string, params: unknown[]) => {
  /* your client */
  return [];
};
const detector = createSlowQueryDetector(
  { warnThresholdMs: 200, requestBudget: { maxQueries: 50 } },
  { logger: createConsoleLogger() },
);
const q = wrapQueryFn(rawQuery, detector);

await runWithDbContext({ requestId: "job-7" }, async () => {
  await q("select 1", []);
});
```

## Request budgets (per `requestId`)

Set `requestBudget.maxQueries` and/or `requestBudget.maxTotalDurationMs` to catch **query storms** (many fast queries) that stay under single-query latency thresholds. Counts and duration are summed **per `requestId`** for the lifetime of that id in the LRU map (in-process only).

- **Successful and failed** `executeQuery` completions both increment the budget (every round-trip attempt counts).
- The first time a limit is exceeded for a `requestId`, sinks receive one **`db.request.budget`** event (`LoggerSink` → **warn**). A second violation for the same id is only possible after that id falls out of the LRU (e.g. many concurrent requests with unique ids).
- **`requestBudget.maxTrackedRequests`** bounds memory (default **5000**); non-finite or `< 1` values are normalized.

**Custom sinks:** `IEventSink.handle` receives **`DetectorEvent`** (`QueryEvent | RequestBudgetViolationEvent`). Branch on `event.event === "db.request.budget"` before assuming `sql` / `subtype` exist.

**Advanced:** `new SlowQueryDetector(config, undefined, sinks)` does **not** install the default `getDbContext()` provider — use **`createSlowQueryDetector`** or pass `contextProvider: { getContext: () => getDbContext() }` if you construct the detector yourself.

## Prisma

```bash
npm install @olegkoval/queryd @prisma/client
```

```ts
import { PrismaClient } from "@prisma/client";
import { createSlowQueryDetector, createConsoleLogger, runWithDbContext } from "@olegkoval/queryd";
import { wrapPrismaClient } from "@olegkoval/queryd/prisma";

const base = new PrismaClient();
const detector = createSlowQueryDetector(
  {
    warnThresholdMs: 200,
    dbName: "primary",
    requestBudget: { maxQueries: 80, maxTotalDurationMs: 2_000 },
  },
  { logger: createConsoleLogger() },
);
export const prisma = wrapPrismaClient(base, detector);

await runWithDbContext({ requestId: "req-1", userId: "u-1" }, async () => {
  await prisma.$queryRaw`SELECT 1`;
});
```

`wrapPrismaClient` lives on **`@olegkoval/queryd/prisma`** so the core package stays free of a hard `@prisma/client` dependency. The Prisma path is the same **`requestBudget` + `runWithDbContext`** pattern as the driver-agnostic examples above.

### Sentry / other backends

Use `ILogger` and wire your adapter (e.g. `@sentry/nextjs` `captureMessage` / `captureEvent`) in the app; the package ships **`createNoopLogger`** and **`createConsoleLogger`** only.

## Roadmap

- `@queryd/core` scoped publish (if namespace available)
- Companion packages: `queryd-go`, `queryd-py` (WIP)
- Raise test coverage thresholds back toward 100% (edge branches in `ExplainThrottle` / nested transaction paths)

## License

MIT — see [LICENSE](./LICENSE).
