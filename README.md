# queryd

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/queryd.svg)](https://www.npmjs.com/package/queryd)
[![Node](https://img.shields.io/node/v/queryd.svg)](https://nodejs.org/)
[![CI & Release](https://github.com/oleg-koval/slow-query-detector/actions/workflows/ci-release.yml/badge.svg)](https://github.com/oleg-koval/slow-query-detector/actions/workflows/ci-release.yml)

**queryd** is a database query latency detector for Node.js. The full Prisma integration, sampling, and optional `EXPLAIN` pipeline is being extracted from production code into this open source package.

**GitHub:** [oleg-koval/slow-query-detector](https://github.com/oleg-koval/slow-query-detector) — npm package name is **queryd**.

## What you are installing (honest snapshot)

**Today:** you get a small published surface (`getVersion()` and types) plus automated **tests, lint, format check, coverage (uploaded in CI), and build** on every change. That is intentional: the package is on npm so early adopters can pin versions while the detector core lands.

**Next:** the goal is to let you **flag database work that exceeds a latency budget** (for example, “warn when a query or ORM call takes longer than 100ms”), with a **Prisma-friendly** integration path, **sampling** so overhead stays predictable, and an optional **`EXPLAIN`** pipeline for the worst offenders. Until those APIs ship, treat this release as **infrastructure + a version hook**, not a full detector in a box.

If that sentence is too abstract: imagine a **speed budget for SQL** from your Node process—queryd is meant to become the plumbing that notices when you blow the budget, without you hand-rolling timers everywhere.

## Status

Early bootstrap: public API is still a placeholder while the detector core is migrated. Semantics and defaults may change in `0.x`; pin a version if you depend on it.

## Install

```bash
npm install queryd
```

If install fails, confirm registry access and the [npm package page](https://www.npmjs.com/package/queryd). For build-from-source or pre-release issues, open an [issue](https://github.com/oleg-koval/slow-query-detector/issues).

## Usage (placeholder)

```ts
import { getVersion } from "queryd";

console.log(getVersion());
```

## Roadmap

- `@queryd/core` scoped publish (if namespace available)
- Companion packages: `queryd-go`, `queryd-py`

## License

MIT — see [LICENSE](./LICENSE).
