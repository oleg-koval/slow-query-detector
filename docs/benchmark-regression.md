# E2E dataset benchmark: multi-run analytics & CI regression gate

## What runs locally

Single run (one aggregate measurement after warm-up):

```bash
npm run benchmark:e2e:dataset:docker
```

Multi-run series (same process, same DB): repeats the interleaved harness `BENCH_SERIES_RUNS` times and prints **mean / median / stdev / min / max / CV%** per scenario.

```bash
BENCH_SERIES_RUNS=10 BENCH_DATASET_ROWS=200000 BENCH_ITERATIONS=3000 BENCH_WARMUP=300 npm run benchmark:e2e:dataset:docker
```

Machine-readable output:

- A single stdout line prefixed with `BENCH_JSON_RESULT:` (JSON payload).
- Optional file: set `BENCH_OUTPUT_FILE=bench/latest-e2e-dataset.json` (ignored by git) to persist the JSON for tooling.

## Reading the aggregate table & `BENCH_JSON_RESULT`

### What is being measured?

Each scenario row reflects **one full execution** of the dataset query path: tagged SQL through the client, round-trip to Postgres, and the result. Times are **microseconds per operation** (`us/op`). For example **345 µs/op** is about **0.345 ms** per query **on average over that scenario’s timed loop**—including container/DB/network effects, not “queryd CPU only.”

The three scenarios share the same SQL shape:

1. **Bare** — `postgres.js` only.
2. **wrapTaggedTemplate (no request budget)** — same query through queryd without request-budget accounting.
3. **wrapTaggedTemplate (+ request budget)** — same query through queryd with request-budget tracking enabled.

### Aggregate table columns (`## Aggregate across N runs`)

After `BENCH_SERIES_RUNS > 1`, the harness prints one **mean `perOpUs` per full interleaved pass** for each scenario, then summarizes those pass-level numbers:

| Column        | Meaning                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **mean**      | Average of the **N** pass-level `perOpUs` values for that scenario.                                                                                                                                                                                                                                                                        |
| **median**    | Middle value of those N numbers (sorted)—**more robust to outliers** than mean; a good default “typical” headline.                                                                                                                                                                                                                         |
| **stdev**     | Sample standard deviation across the N passes—how much run-to-run spread you saw.                                                                                                                                                                                                                                                          |
| **min / max** | Fastest and slowest pass for that scenario.                                                                                                                                                                                                                                                                                                |
| **CV %**      | Coefficient of variation: `(stdev / mean) × 100`. **Higher = noisier** (DB cache, scheduler, GC, container load). Rough guide: **below ~10%** is fairly tight on shared runners; **10–20%** is common for DB-backed benches; **above ~25%** suggests reducing noise (more iterations, fewer competing processes) or widening CI tolerance. |

**Reading your headline:** prefer **`median`** (or mean if distribution is symmetric) for comparing scenarios or updating `ceilingMedianPerOpUs` in `bench/e2e-dataset-baseline.json`. If wrapped medians are only a few µs above bare, wrapper cost is **small relative to total query time** on that workload—which is expected when Postgres dominates.

### `BENCH_JSON_RESULT` JSON fields

The trailing `BENCH_JSON_RESULT:{...}` line is one JSON object. Important parts:

- **`config`** — `BENCH_ITERATIONS`, `BENCH_WARMUP`, `BENCH_DATASET_ROWS`, `BENCH_SERIES_RUNS`, Node version, platform, DB host. Use this to prove two runs were **comparable**.
- **`perRun`** — Array of **N** passes; each entry is the three scenarios’ `perOpUs` for that pass (good for spotting a single bad pass).
- **`aggregate`** — Per scenario: `perOpUsMean`, `perOpUsMedian`, `perOpUsStdev`, `perOpUsMin`, `perOpUsMax`, and `perRunValues` (the raw list of N pass medians). **Use `aggregate` for CI baselines and published summaries.**
- **`lastRunTable`** — Only the **last** pass, with “overhead vs baseline” for that pass (baseline = bare in the same pass). Useful for debugging; **do not treat it as the same thing as `aggregate`** when you quote “the” benchmark result.

## CI gate (how regression blocking works)

1. CI runs the dataset benchmark against **Postgres in GitHub Actions** with a **fixed workload** (rows / iterations / warmup / series runs) so results are comparable run-to-run.
2. CI writes JSON to `bench/latest-e2e-dataset.json`.
3. `npm run bench:compare:e2e:dataset` reads `bench/e2e-dataset-baseline.json` and the latest JSON.
4. If `enforced` is `false`, the compare step **passes** but logs that the gate is inactive (safe default for new repos).
5. When you are ready to block regressions:
   - Run the benchmark on a stable reference (your laptop in Docker, or CI artifact).
   - Copy **median** `perOpUs` values from `aggregate[]` into `ceilingMedianPerOpUs` (these are **ceilings**: regressions are slower = higher µs/op).
   - Set `enforced` to `true` and align `workload` in the baseline file with the CI workload.

**Rule:** for each slug with a numeric ceiling, the job fails if:

`currentMedian > ceiling * (1 + toleranceRatio)`

So `toleranceRatio: 0.12` allows up to **+12%** slack vs the stored ceiling (noise + hardware variance).

## Updating the baseline when you intentionally improve performance

Lower the ceilings (or keep tolerance) so the new faster medians become the new bar:

1. Merge the performance improvement.
2. Re-run the benchmark on `main` (or CI artifact), copy new medians into `bench/e2e-dataset-baseline.json`.
3. Open a small PR that only updates the baseline file (easy to review).

## Alternatives (not implemented here)

- **Dedicated services**: [Bencher](https://bencher.dev/), [Continuous Benchmark](https://github.com/marketplace?type=actions&query=benchmark), or storing time-series in your observability stack.
- **Strict statistical tests**: e.g. Mann–Whitney across N runs on dedicated hardware (slower CI, fewer flakes on noisy runners).

This repo uses a **simple ceiling + tolerance** model so you can ship a regression gate without external accounts.
