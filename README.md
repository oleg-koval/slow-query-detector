# queryd

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

**queryd** is a database query latency detector for Node.js: **driver-agnostic** hooks (`wrapQueryFn`, `wrapTaggedTemplate`, `SlowQueryDetector.executeQuery`), optional **Prisma** integration behind `@olegkoval/queryd/prisma`, sampling, optional `EXPLAIN ANALYZE`, and pluggable sinks.

Project site: [oleg-koval.github.io/slow-query-detector](https://oleg-koval.github.io/slow-query-detector/).

## Install

```bash
npm install @olegkoval/queryd
```

Add `@prisma/client` only if you use the Prisma entry (see below).

## Usage (any stack)

`SlowQueryDetector.executeQuery` runs your callback and emits `QueryEvent`s. Wrappers cover common shapes:

- **`wrapQueryFn`** — `(sql: string, params?) => Promise<unknown>` (raw clients, thin DB helpers).
- **`wrapTaggedTemplate`** — tagged template `(strings, ...values) => Promise<unknown>` (e.g. **postgres.js** `sql`, same literal shape as Prisma `$queryRaw`).
- **`extractQueryInfo`** — build `$1…$n` SQL + params from a `TemplateStringsArray` if you wire a custom executor.

```ts
import postgres from "postgres";
import {
  createSlowQueryDetector,
  wrapTaggedTemplate,
  createConsoleLogger,
} from "@olegkoval/queryd";

const sql = postgres(process.env.DATABASE_URL!);
const detector = createSlowQueryDetector(
  { warnThresholdMs: 200, dbName: "primary" },
  { logger: createConsoleLogger() },
);
const instrumentedSql = wrapTaggedTemplate(sql, detector);
await instrumentedSql`SELECT ${1}::int`;
```

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
  { warnThresholdMs: 200, dbName: "primary" },
  { logger: createConsoleLogger() },
);
export const prisma = wrapPrismaClient(base, detector);

await runWithDbContext({ requestId: "req-1", userId: "u-1" }, async () => {
  await prisma.$queryRaw`SELECT 1`;
});
```

### Sentry / other backends

Use `ILogger` and wire your adapter (e.g. `@sentry/nextjs` `captureMessage` / `captureEvent`) in the app; the package ships **`createNoopLogger`** and **`createConsoleLogger`** only.

## Roadmap

- `@queryd/core` scoped publish (if namespace available)
- Companion packages: `queryd-go`, `queryd-py`
- Raise test coverage thresholds back toward 100% (edge branches in `ExplainThrottle` / nested transaction paths)

## License

MIT — see [LICENSE](./LICENSE).
