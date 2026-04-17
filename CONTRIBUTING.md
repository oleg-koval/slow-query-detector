# Contributing

Thanks for helping improve **queryd** (`@olegkoval/queryd`).

## Quick start for contributors

- **Node:** 18+ (see `package.json` `engines`).
- **Install:** `npm ci`
- **Checks before a PR:**
  - `npm test`
  - `npm run build`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`

## Pull requests

- Keep changes focused; match existing style and tests.
- If you change user-visible behavior, update `README.md` or `docs/` as needed.
- PR descriptions with short **usage** snippets help reviewers (see repo rule on PR examples).

## Benchmarks

- Micro-benchmark: `npm run benchmark`
- Postgres e2e (Docker): see `README.md` **Benchmark** section (`benchmark:e2e:docker`, `benchmark:e2e:dataset:docker`, etc.).
- Regression compare: `docs/benchmark-regression.md`

## Integration friction

If wrapping queryd in a real app was awkward, open **[Integration feedback](https://github.com/oleg-koval/slow-query-detector/issues/new/choose)** (pick **Integration feedback** on the template page) with stack details. That feedback drives docs and examples.

The `?template=integration-feedback.md` deep link only works once this template file is on your **default branch** on GitHub; **`/issues/new/choose`** is the reliable URL.

## Security

Do not paste production secrets or full connection strings in issues. Use redacted examples.
