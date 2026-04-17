import { readFile } from "node:fs/promises";

type BaselineFile = {
  schemaVersion: number;
  enforced: boolean;
  toleranceRatio: number;
  workload: {
    BENCH_DATASET_ROWS: number;
    BENCH_ITERATIONS: number;
    BENCH_WARMUP: number;
    BENCH_SERIES_RUNS: number;
  };
  /** Median us/op from a calibrated run; CI fails if current median exceeds ceiling * (1 + toleranceRatio). */
  ceilingMedianPerOpUs: Partial<Record<"bare" | "wrapNoBudget" | "wrapBudget", number | null>>;
};

type BenchResult = {
  kind: string;
  aggregate: { slug: string; perOpUsMedian: number }[];
  config: {
    BENCH_DATASET_ROWS: number;
    BENCH_ITERATIONS: number;
    BENCH_WARMUP: number;
    BENCH_SERIES_RUNS: number;
  };
  seriesRuns: number;
};

async function main(): Promise<void> {
  const resultPath = process.argv[2] ?? "bench/latest-e2e-dataset.json";
  const baselinePath = process.argv[3] ?? "bench/e2e-dataset-baseline.json";

  const baselineRaw = await readFile(baselinePath, "utf8");
  const baseline = JSON.parse(baselineRaw) as BaselineFile;

  if (!baseline.enforced) {
    console.log(
      `[bench] Baseline not enforced (${baselinePath} enforced=false). Skipping regression gate.`,
    );
    process.exit(0);
  }

  const resultRaw = await readFile(resultPath, "utf8");
  const current = JSON.parse(resultRaw) as BenchResult;

  if (current.kind !== "queryd-bench-e2e-dataset") {
    throw new Error(`Unexpected result kind: ${String(current.kind)}`);
  }

  const w = baseline.workload;
  if (
    current.config.BENCH_DATASET_ROWS !== w.BENCH_DATASET_ROWS ||
    current.config.BENCH_ITERATIONS !== w.BENCH_ITERATIONS ||
    current.config.BENCH_WARMUP !== w.BENCH_WARMUP ||
    current.config.BENCH_SERIES_RUNS !== w.BENCH_SERIES_RUNS
  ) {
    console.error("[bench] Workload mismatch between baseline and current run:");
    console.error("  baseline:", w);
    console.error("  current: ", {
      BENCH_DATASET_ROWS: current.config.BENCH_DATASET_ROWS,
      BENCH_ITERATIONS: current.config.BENCH_ITERATIONS,
      BENCH_WARMUP: current.config.BENCH_WARMUP,
      BENCH_SERIES_RUNS: current.config.BENCH_SERIES_RUNS,
    });
    process.exit(1);
  }

  const tol = baseline.toleranceRatio;
  const failures: string[] = [];

  for (const row of current.aggregate) {
    const slug = row.slug as keyof BaselineFile["ceilingMedianPerOpUs"];
    const ceiling = baseline.ceilingMedianPerOpUs[slug];
    if (ceiling === null || ceiling === undefined) {
      continue;
    }
    const limit = ceiling * (1 + tol);
    if (row.perOpUsMedian > limit) {
      failures.push(
        `${slug}: median ${row.perOpUsMedian.toFixed(3)} us/op > ceiling*(${1 + tol}) = ${limit.toFixed(3)} (ceiling ${ceiling})`,
      );
    }
  }

  if (failures.length > 0) {
    console.error("[bench] Regression detected vs baseline ceilings:\n" + failures.join("\n"));
    process.exit(1);
  }

  console.log("[bench] OK: all checked medians are within baseline ceilings + tolerance.");
}

await main();
