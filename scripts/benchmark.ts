import { createSlowQueryDetector, wrapQueryFn } from "../src/index";
import { createNoopLogger } from "../src/logger";

const ITERATIONS = Number.parseInt(process.env.BENCH_ITERATIONS ?? "100000", 10);
const WARMUP = Number.parseInt(process.env.BENCH_WARMUP ?? "5000", 10);

const noopQuery = async () => 1;
const noopLogger = createNoopLogger();

const detector = createSlowQueryDetector(
  {
    warnThresholdMs: 200,
    dbName: "bench",
  },
  {
    logger: noopLogger,
  },
);

const detectorWithBudget = createSlowQueryDetector(
  {
    warnThresholdMs: 200,
    dbName: "bench",
    requestBudget: {
      maxQueries: 1000000,
      maxTotalDurationMs: 1000000,
    },
  },
  {
    logger: noopLogger,
  },
);

const wrappedNoBudget = wrapQueryFn(noopQuery, detector);
const wrappedWithBudget = wrapQueryFn(noopQuery, detectorWithBudget);

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

const results = [];
results.push(await measure("bare async query fn", async () => noopQuery()));
results.push(
  await measure("wrapQueryFn (no request budget)", async () => wrappedNoBudget("select 1", [])),
);
results.push(
  await measure("wrapQueryFn (+ request budget)", async () => wrappedWithBudget("select 1", [])),
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

console.log(`# queryd micro-benchmark`);
console.log(``);
console.log(`- Iterations: ${ITERATIONS}`);
console.log(`- Warmup: ${WARMUP}`);
console.log(`- Node: ${process.version}`);
console.log(`- Platform: ${process.platform} ${process.arch}`);
console.log(``);
console.log(
  `| Scenario | Mean (us/op) | Throughput (ops/s) | Delta vs baseline (us) | Delta vs baseline (%) |`,
);
console.log(`|---|---:|---:|---:|---:|`);

for (const result of normalized) {
  console.log(
    `| ${result.name} | ${result.perOpUs.toFixed(3)} | ${result.opsPerSecond.toLocaleString()} | ${result.overheadUs.toFixed(3)} | ${result.overheadPercent.toFixed(2)}% |`,
  );
}
