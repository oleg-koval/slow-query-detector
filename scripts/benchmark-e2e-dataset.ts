import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import {
  createNoopLogger,
  createSlowQueryDetector,
  runWithDbContext,
  wrapTaggedTemplate,
} from "../src/index";

const ITERATIONS = Number.parseInt(process.env.BENCH_ITERATIONS ?? "2000", 10);
const WARMUP = Number.parseInt(process.env.BENCH_WARMUP ?? "200", 10);
const ROW_COUNT = Number.parseInt(process.env.BENCH_DATASET_ROWS ?? "100000", 10);
const SERIES_RUNS = Math.max(1, Number.parseInt(process.env.BENCH_SERIES_RUNS ?? "1", 10));
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@postgres:5432/queryd_bench";

const sql = postgres(DATABASE_URL, {
  max: 1,
  connect_timeout: 10,
});

type TaggedQueryFn = (
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
) => Promise<unknown>;

const sqlTagged = sql as unknown as TaggedQueryFn;

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

async function seedDataset(): Promise<void> {
  await sql`
    create table if not exists bench_users (
      id bigserial primary key,
      tenant_id int not null,
      status text not null,
      score int not null,
      created_at timestamptz not null default now()
    )
  `;

  const [{ count }] = await sql<
    { count: string }[]
  >`select count(*)::text as count from bench_users`;
  if (Number.parseInt(count, 10) >= ROW_COUNT) {
    await sql`create index if not exists idx_bench_users_tenant_status on bench_users (tenant_id, status)`;
    return;
  }

  await sql`truncate table bench_users restart identity`;
  await sql`
    insert into bench_users (tenant_id, status, score, created_at)
    select
      (g % 250) + 1,
      case when g % 10 < 7 then 'active' else 'inactive' end,
      (random() * 1000)::int,
      now() - ((g % 365) || ' days')::interval
    from generate_series(1, ${ROW_COUNT}) as g
  `;
  await sql`create index if not exists idx_bench_users_tenant_status on bench_users (tenant_id, status)`;
  await sql`analyze bench_users`;
}

const detector = createSlowQueryDetector(
  {
    warnThresholdMs: 200,
    dbName: "bench-e2e-dataset",
  },
  {
    logger: createNoopLogger(),
  },
);

const detectorWithBudget = createSlowQueryDetector(
  {
    warnThresholdMs: 200,
    dbName: "bench-e2e-dataset",
    requestBudget: {
      maxQueries: 1000000,
      maxTotalDurationMs: 1000000,
    },
  },
  {
    logger: createNoopLogger(),
  },
);

const wrappedNoBudget = wrapTaggedTemplate(sqlTagged, detector);
const wrappedWithBudget = wrapTaggedTemplate(sqlTagged, detectorWithBudget);

const tenantId = 42;

async function runDatasetQuery(queryFn: TaggedQueryFn): Promise<unknown> {
  return queryFn`
    select
      tenant_id,
      status,
      count(*)::int as total,
      avg(score)::float8 as avg_score
    from bench_users
    where tenant_id = ${tenantId} and status = ${"active"}
    group by tenant_id, status
  `;
}

/** All permutations so each scenario is first, middle, and last equally often (reduces DB cache / JIT ordering bias). */
const SCENARIO_PERMUTATIONS: ReadonlyArray<ReadonlyArray<0 | 1 | 2>> = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

type Scenario = {
  name: string;
  run: () => Promise<unknown>;
};

async function measureInterleaved(scenarios: readonly Scenario[]): Promise<
  {
    name: string;
    perOpUs: number;
    opsPerSecond: number;
  }[]
> {
  const totalsNs = scenarios.map(() => 0n);

  for (let i = 0; i < WARMUP; i += 1) {
    const perm = SCENARIO_PERMUTATIONS[i % SCENARIO_PERMUTATIONS.length];
    for (const idx of perm) {
      await scenarios[idx].run();
    }
  }

  for (let i = 0; i < ITERATIONS; i += 1) {
    const perm = SCENARIO_PERMUTATIONS[i % SCENARIO_PERMUTATIONS.length];
    for (const idx of perm) {
      const t0 = process.hrtime.bigint();
      await scenarios[idx].run();
      const t1 = process.hrtime.bigint();
      totalsNs[idx] += t1 - t0;
    }
  }

  return scenarios.map((scenario, idx) => {
    const totalNs = Number(totalsNs[idx]);
    const perOpNs = totalNs / ITERATIONS;
    const perOpUs = perOpNs / 1000;
    const opsPerSecond = Math.round(1e9 / perOpNs);
    return {
      name: scenario.name,
      perOpUs,
      opsPerSecond,
    };
  });
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

await waitForDatabase();
await seedDataset();

const SCENARIO_SLUGS = ["bare", "wrapNoBudget", "wrapBudget"] as const;

type RunRow = {
  run: number;
  slug: (typeof SCENARIO_SLUGS)[number];
  name: string;
  perOpUs: number;
  opsPerSecond: number;
};

const baseContext = { requestId: "bench-e2e-dataset-request" };
const scenarios: readonly Scenario[] = [
  {
    name: "bare postgres.js dataset query",
    run: () => runWithDbContext(baseContext, async () => runDatasetQuery(sqlTagged)),
  },
  {
    name: "wrapTaggedTemplate dataset (no request budget)",
    run: () =>
      runWithDbContext(baseContext, async () =>
        runDatasetQuery(wrappedNoBudget as unknown as TaggedQueryFn),
      ),
  },
  {
    name: "wrapTaggedTemplate dataset (+ request budget)",
    run: () =>
      runWithDbContext(baseContext, async () =>
        runDatasetQuery(wrappedWithBudget as unknown as TaggedQueryFn),
      ),
  },
];

const perRun: RunRow[][] = [];
for (let run = 0; run < SERIES_RUNS; run += 1) {
  perRun.push(
    (await measureInterleaved(scenarios)).map((row, idx) => ({
      run: run + 1,
      slug: SCENARIO_SLUGS[idx],
      name: row.name,
      perOpUs: row.perOpUs,
      opsPerSecond: row.opsPerSecond,
    })),
  );
}

const lastRun = perRun.at(-1)!;
const baseline = lastRun[0]!;
const normalized = lastRun.map((result) => {
  const overheadUs = result.perOpUs - baseline.perOpUs;
  const overheadPercent = (overheadUs / baseline.perOpUs) * 100;
  return {
    ...result,
    overheadUs,
    overheadPercent,
  };
});

const aggregate = SCENARIO_SLUGS.map((slug, idx) => {
  const values = perRun.map((rows) => rows[idx]!.perOpUs);
  return {
    slug,
    name: scenarios[idx]!.name,
    perOpUsMean: mean(values),
    perOpUsMedian: median(values),
    perOpUsStdev: stdev(values),
    perOpUsMin: Math.min(...values),
    perOpUsMax: Math.max(...values),
    perRunValues: values,
  };
});

console.log(`# queryd e2e dataset benchmark (postgres in docker)`);
console.log(``);
console.log(`- Iterations: ${ITERATIONS}`);
console.log(`- Warmup: ${WARMUP}`);
console.log(`- Dataset rows: ${ROW_COUNT}`);
console.log(`- Series runs: ${SERIES_RUNS}`);
console.log(`- Node: ${process.version}`);
console.log(`- Platform: ${process.platform} ${process.arch}`);
console.log(`- Database URL host: ${new URL(DATABASE_URL).hostname}`);
console.log(
  `- Timing: interleaved (6 permutations per iteration) so baseline is not always "cold first" vs "hot last"`,
);
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

if (SERIES_RUNS > 1) {
  console.log(``);
  console.log(`## Aggregate across ${SERIES_RUNS} runs (per scenario, us/op)`);
  console.log(``);
  console.log(`| Scenario | mean | median | stdev | min | max | CV % |`);
  console.log(`|---|---:|---:|---:|---:|---:|---:|`);
  for (const row of aggregate) {
    const cv = row.perOpUsMean > 0 ? (row.perOpUsStdev / row.perOpUsMean) * 100 : 0;
    console.log(
      `| ${row.name} | ${row.perOpUsMean.toFixed(3)} | ${row.perOpUsMedian.toFixed(3)} | ${row.perOpUsStdev.toFixed(3)} | ${row.perOpUsMin.toFixed(3)} | ${row.perOpUsMax.toFixed(3)} | ${cv.toFixed(2)}% |`,
    );
  }
}

const jsonPayload = {
  kind: "queryd-bench-e2e-dataset",
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  seriesRuns: SERIES_RUNS,
  config: {
    BENCH_ITERATIONS: ITERATIONS,
    BENCH_WARMUP: WARMUP,
    BENCH_DATASET_ROWS: ROW_COUNT,
    BENCH_SERIES_RUNS: SERIES_RUNS,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    databaseHost: new URL(DATABASE_URL).hostname,
  },
  lastRunTable: normalized,
  aggregate,
  perRun,
};

const jsonLine = `BENCH_JSON_RESULT:${JSON.stringify(jsonPayload)}`;
console.log(``);
console.log(jsonLine);

const outFile = process.env.BENCH_OUTPUT_FILE;
if (outFile) {
  await writeFile(outFile, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
}

await sql.end({ timeout: 5 });
