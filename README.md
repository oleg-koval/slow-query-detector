# queryd

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/queryd.svg)](https://nodejs.org/)

<!-- npm badge after first publish: [![npm](https://img.shields.io/npm/v/queryd.svg)](https://www.npmjs.com/package/queryd) -->

**queryd** is a database query latency detector for Node.js, with first-class **Prisma** support (`$queryRaw`, `$executeRaw`, interactive `$transaction`), sampling, optional `EXPLAIN ANALYZE`, and pluggable sinks.

## Peer dependency

Install `@prisma/client` in your app (same major as your schema). `queryd` does not bundle Prisma.

## Install

```bash
npm install queryd @prisma/client
```

## Usage

```ts
import { PrismaClient } from "@prisma/client";
import {
  createSlowQueryDetector,
  wrapPrismaClient,
  createConsoleLogger,
  runWithDbContext,
} from "queryd";

const base = new PrismaClient();
const detector = createSlowQueryDetector(
  { warnThresholdMs: 200, dbName: "primary" },
  { logger: createConsoleLogger() },
);
export const prisma = wrapPrismaClient(base, detector);

// Optional: request-scoped context for events
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
