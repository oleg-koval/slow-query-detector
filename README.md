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

Catch slow queries before your users feel them.

**queryd** is a lightweight query observability layer for Node.js: **driver-agnostic** hooks (`wrapQueryFn`, `wrapTaggedTemplate`, `SlowQueryDetector.executeQuery`), optional **Prisma** integration via `@olegkoval/queryd/prisma`, sampling, optional **per-request query budgets**, optional `EXPLAIN ANALYZE`, and pluggable sinks.

- Add instrumentation in minutes, not days.
- Keep your current DB client and query style.
- Detect both single slow queries and request-level query storms.

Project site: [oleg-koval.github.io/slow-query-detector](https://oleg-koval.github.io/slow-query-detector/).

## Install

```bash
npm install @olegkoval/queryd
```

Add `@prisma/client` only if you use the Prisma entry (see below).

## 60-second quick start

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
const db = wrapTaggedTemplate(sql, detector);

await runWithDbContext({ requestId: "req-home-1", userId: "u-42" }, async () => {
  await db`select ${1}::int`;
});
```

What you get right away:

- Structured query events you can route to logs/APM.
- Automatic request context propagation with `runWithDbContext`.
- Budget violation signal (`db.request.budget`) for high-query requests.

## Benchmark

Use this command for a fast, reproducible local micro-benchmark:

```bash
npm run benchmark
```

Docker validation (recommended for CI/consistent environment):

```bash
docker run --rm -v "$PWD:/app" -w /app node:22 \
  bash -lc "npm ci --ignore-scripts && npm run benchmark"
```

Docker Compose validation:

```bash
npm run benchmark:docker
```

`benchmark:docker` installs dependencies with dev packages included, so `tsx` is available and no interactive install prompt appears.

E2E benchmark against Postgres in Docker (real DB round-trips):

```bash
npm run benchmark:e2e:docker
```

This mode starts a `postgres:16` container and benchmarks `wrapTaggedTemplate` against a real `select 1` query path.
Use this for end-to-end signal; use `npm run benchmark` for isolated in-process wrapper overhead.

Dataset-backed E2E benchmark (seeded table + filtered aggregate query):

```bash
npm run benchmark:e2e:dataset:docker
```

Optional dataset/loop tuning:

```bash
BENCH_DATASET_ROWS=200000 BENCH_ITERATIONS=3000 BENCH_WARMUP=300 npm run benchmark:e2e:dataset:docker
```

This mode seeds `bench_users` in Postgres and runs a realistic indexed filter + aggregate query, so results include actual DB planner/cache/index behavior in Docker.

Multi-run series (mean / median / stdev / CV%) in one container — good for publishing stable numbers:

```bash
npm run benchmark:e2e:dataset:10:docker
```

CI compares each PR against `bench/e2e-dataset-baseline.json` (median ceilings + tolerance); see **[docs/benchmark-regression.md](./docs/benchmark-regression.md)** for how to turn enforcement on, refresh baselines after real improvements, and **how to read the aggregate table and `BENCH_JSON_RESULT` output**.

Timing is **interleaved** (all six orderings of the three scenarios rotate each iteration) so one path is not always measured first while Postgres buffers and JIT warm up — that avoids misleading rows where “overhead” looks negative.

#### Example dataset run (sequential-only harness — why interleaving exists)

If you see a **negative** “Added overhead” on the budget row, that is almost always **measurement noise**, not “instrumentation made Postgres faster”: same query and data, but **order effects** (the first scenario pays cold cache / planner / JIT; later rows look artificially fast). The current script uses **interleaved** timing to reduce this; treat small negative deltas as “≈0 within noise” if they still appear.

Example output from a **sequential-only** run (your parameters):

- Iterations: 3000
- Warmup: 300
- Dataset rows: 200000
- Node: v22.22.2
- Platform: linux arm64
- Database URL host: postgres

| Scenario                                       | Mean (us/op) | Throughput (ops/s) | Added overhead vs baseline (us) | Relative overhead vs baseline (%) |
| ---------------------------------------------- | -----------: | -----------------: | ------------------------------: | --------------------------------: |
| bare postgres.js dataset query                 |      407.226 |              2,456 |                           0.000 |                             0.00% |
| wrapTaggedTemplate dataset (no request budget) |      436.042 |              2,293 |                          28.816 |                             7.08% |
| wrapTaggedTemplate dataset (+ request budget)  |      301.826 |              3,313 |                        -105.400 |                           -25.88% |

Override benchmark loop sizes (optional):

```bash
BENCH_ITERATIONS=200000 BENCH_WARMUP=10000 docker compose run --rm benchmark
```

### Latest benchmark results

Environment:

- Node `v20.20.2`
- Platform `linux arm64`
- Iterations `100000`, warmup `5000`

| Scenario                        | Mean (us/op) | Throughput (ops/s) | Added overhead vs baseline (us) | Relative overhead vs baseline (%) |
| ------------------------------- | -----------: | -----------------: | ------------------------------: | --------------------------------: |
| bare async query fn             |        0.201 |          4,974,516 |                           0.000 |                             0.00% |
| wrapQueryFn (no request budget) |        1.508 |            663,089 |                           1.307 |                           650.20% |
| wrapQueryFn (+ request budget)  |        1.888 |            529,636 |                           1.687 |                           839.23% |

Interpretation:

- These numbers describe **added latency overhead**, not "speed increase."
- Example: `+839%` here means about **+1.687 us/op** over a tiny `0.201 us/op` baseline.
- Large percentages are expected when the baseline operation is near-zero.

Scope (important):

- This micro-benchmark runs a **noop async query function** to isolate `queryd` wrapper cost.
- It does **not** execute real SQL and does **not** contact a database.
- `Iterations: 100000` means 100k benchmark function calls (in-process), not 100k DB round-trips.

Why not benchmark only against DB in Docker?

- Real DB benchmarks mix many variables (network, kernel scheduler, DB cache, query planner, disk, container contention).
- For library overhead, we first measure a controlled in-process baseline so wrapper cost is visible.
- DB-inclusive benchmarks are still valuable, but they answer a different question: **end-to-end system performance**, not pure instrumentation overhead.

### Git hooks (contributors)

`npm install` enables a **pre-commit** hook ([Husky](https://typicode.github.io/husky/)) that runs **`npm run lint`**, **`npm run format:check`**, and **`npm test`**. To skip hooks for a one-off commit: `HUSKY=0 git commit …`.

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
import {
  createSlowQueryDetector,
  wrapQueryFn,
  createConsoleLogger,
  runWithDbContext,
} from "@olegkoval/queryd";

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

Background, practices, and sources: **[docs/budget.md](./docs/budget.md)**.

Set `requestBudget.maxQueries` and/or `requestBudget.maxTotalDurationMs` to catch **query storms** (many fast queries) that stay under single-query latency thresholds. Counts and duration are summed **per `requestId`** for the lifetime of that id in the LRU map (in-process only). Negative or non-finite `maxQueries` values are ignored (no cap on query count); use `0` to mean “no queries allowed” before the first violation.

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). If adoption was awkward in your stack, open **Integration feedback** via [New issue → choose a template](https://github.com/oleg-koval/slow-query-detector/issues/new/choose) (pick **Integration feedback**).

## License

MIT — see [LICENSE](./LICENSE).
