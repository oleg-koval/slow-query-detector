# queryd

<p align="center">
  <img src="./docs/assets/queryd-wordmark.png" alt="queryd" width="520" />
</p>

[![CI](https://img.shields.io/github/actions/workflow/status/oleg-koval/slow-query-detector/ci-release.yml?branch=main&logo=github&label=ci)](https://github.com/oleg-koval/slow-query-detector/actions/workflows/ci-release.yml?query=branch%3Amain)
[![Coverage](https://img.shields.io/coverallsCoverage/github/oleg-koval/slow-query-detector?branch=main&logo=coveralls)](https://coveralls.io/github/oleg-koval/slow-query-detector)
[![npm version](https://img.shields.io/npm/v/@olegkoval%2Fqueryd.svg?logo=npm&label=npm)](https://www.npmjs.com/package/@olegkoval/queryd)
[![npm downloads](https://img.shields.io/npm/dm/@olegkoval%2Fqueryd.svg?logo=npm&label=downloads)](https://www.npmjs.com/package/@olegkoval/queryd)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/@olegkoval%2Fqueryd.svg?logo=node.js&label=node)](https://nodejs.org/)
[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-5eead4)](https://oleg-koval.github.io/slow-query-detector/)

**queryd** is a database query latency detector for Node.js, with first-class **Prisma** support (`$queryRaw`, `$executeRaw`, interactive `$transaction`), sampling, optional `EXPLAIN ANALYZE`, and pluggable sinks.

Project site: [oleg-koval.github.io/slow-query-detector](https://oleg-koval.github.io/slow-query-detector/).

## Peer dependency

Install `@prisma/client` in your app (same major as your schema). `queryd` does not bundle Prisma.

## Install

```bash
npm install @olegkoval/queryd @prisma/client
```

## Usage

```ts
import { PrismaClient } from "@prisma/client";
import {
  createSlowQueryDetector,
  wrapPrismaClient,
  createConsoleLogger,
  runWithDbContext,
} from "@olegkoval/queryd";

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
