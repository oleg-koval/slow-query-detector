# queryd

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/queryd.svg)](https://nodejs.org/)

<!-- npm badge after first publish: [![npm](https://img.shields.io/npm/v/queryd.svg)](https://www.npmjs.com/package/queryd) -->

**queryd** is a database query latency detector for Node.js. The full Prisma integration, sampling, and optional `EXPLAIN` pipeline is being extracted from production code into this open source package.

## Status

Early bootstrap: public API is a placeholder while the detector core is migrated.

## Install

```bash
npm install queryd
```

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
