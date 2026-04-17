import postgres from "postgres";
import {
  createNoopLogger,
  createSlowQueryDetector,
  runWithDbContext,
  wrapTaggedTemplate,
} from "../src/index";

const ITERATIONS = Number.parseInt(process.env.BENCH_ITERATIONS ?? "5000", 10);
const WARMUP = Number.parseInt(process.env.BENCH_WARMUP ?? "500", 10);
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@postgres:5432/queryd_bench";

const sql = postgres(DATABASE_URL, {
  max: 1,
  connect_timeout: 10,
});

async function waitForDatabase(maxAttempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await sql`select 1`;
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

const detector = createSlowQueryDetector(
  {
    warnThresholdMs: 200,
    dbName: "bench-e2e",
  },
  {
    logger: createNoopLogger(),
  },
);

const detectorWithBudget = createSlowQueryDetector(
  {
    warnThresholdMs: 200,
    dbName: "bench-e2e",
    requestBudget: {
      maxQueries: 1000000,
      maxTotalDurationMs: 1000000,
    },
  },
  {
    logger: createNoopLogger(),
  },
);

type TaggedQueryFn = (
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
) => Promise<unknown>;

const sqlTagged = sql as unknown as TaggedQueryFn;
const wrappedNoBudget = wrapTaggedTemplate(sqlTagged, detector);
const wrappedWithBudget = wrapTaggedTemplate(sqlTagged, detectorWithBudget);

async function measure(name: string, fn: () => Promise<unknown>) {
  for (let i = 0; i < WARMUP; i += 1) {
    await fn();
  }

  const start = process.hrtime.bigint();
  for (let i = 0; i < ITERATIONS; i += 1) {
    await fn();
  }
  const end = process.hrtime.bigint();

  const totalNs = Number(end - start);
  const perOpNs = totalNs / ITERATIONS;
  const perOpUs = perOpNs / 1000;
  const opsPerSecond = Math.round(1e9 / perOpNs);

  return {
    name,
    perOpUs,
    opsPerSecond,
  };
}

await waitForDatabase();

const baseContext = { requestId: "bench-e2e-request" };
const results = [];
results.push(
  await measure("bare postgres.js tagged query", async () =>
    runWithDbContext(baseContext, async () => sqlTagged`select 1`),
  ),
);
results.push(
  await measure("wrapTaggedTemplate (no request budget)", async () =>
    runWithDbContext(baseContext, async () => wrappedNoBudget`select 1`),
  ),
);
results.push(
  await measure("wrapTaggedTemplate (+ request budget)", async () =>
    runWithDbContext(baseContext, async () => wrappedWithBudget`select 1`),
  ),
);

const baseline = results[0];
const normalized = results.map((result) => {
  const overheadUs = result.perOpUs - baseline.perOpUs;
  const overheadPercent = (overheadUs / baseline.perOpUs) * 100;
  return {
    ...result,
    overheadUs,
    overheadPercent,
  };
});

console.log(`# queryd e2e benchmark (postgres in docker)`);
console.log(``);
console.log(`- Iterations: ${ITERATIONS}`);
console.log(`- Warmup: ${WARMUP}`);
console.log(`- Node: ${process.version}`);
console.log(`- Platform: ${process.platform} ${process.arch}`);
console.log(`- Database URL host: ${new URL(DATABASE_URL).hostname}`);
console.log(``);
console.log(
  `| Scenario | Mean (us/op) | Throughput (ops/s) | Added overhead vs baseline (us) | Relative overhead vs baseline (%) |`,
);
console.log(`|---|---:|---:|---:|---:|`);

for (const result of normalized) {
  console.log(
    `| ${result.name} | ${result.perOpUs.toFixed(3)} | ${result.opsPerSecond.toLocaleString()} | ${result.overheadUs.toFixed(3)} | ${result.overheadPercent.toFixed(2)}% |`,
  );
}

await sql.end({ timeout: 5 });
