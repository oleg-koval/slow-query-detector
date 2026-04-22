# Case study: Next.js portfolio on Neon (dogfooding `@olegkoval/queryd`)

This document describes how **queryd** is used in a real production-shaped app: a **Next.js 15** portfolio site backed by **Neon** (serverless Postgres over the HTTP driver), with **no** dedicated APM product required for basic SQL latency visibility.

**Repository:** [oleg-koval/github-portfolio](https://github.com/oleg-koval/github-portfolio) (reference integration; paths below match that tree).

---

## Summary

| Item              | Choice                                                                   |
| ----------------- | ------------------------------------------------------------------------ |
| Runtime           | Node.js (Next.js App Router, server components & route handlers)         |
| Database          | Neon via `@neondatabase/serverless`                                      |
| Integration point | `wrapTaggedTemplate` around `neon(url)`                                  |
| Logging           | Custom `ILogger` adapter to **pino** (structured JSON logs)              |
| Request budgets   | Not enabled in this deployment (single-query thresholds + sampling only) |

---

## Context

The site uses SQL for **blog posts** and **CV request / decision** flows. Traffic is modest, but failures and slow queries should be visible in **normal application logs** (stdout → hosting log drain) without adding another vendor or wrapping every route in custom timing code.

queryd fits because it stays **close to the DB client**: one wrapper at the `sql`…`` entry point, driver-agnostic semantics, and structured events suitable for log pipelines.

---

## Problem

- **Blind spots:** Without instrumentation, a regressed query or missing index shows up only as “the page feels slow” or generic 504s.
- **Noise:** Logging every query in production is expensive and drowns signal.
- **Lock-in:** The team wanted observability without committing to a specific APM product for a personal portfolio.

---

## Solution

1. **Single module** (`lib/db/neon.ts`) creates the Neon client and wraps the **tagged template** function with `createSlowQueryDetector` + `wrapTaggedTemplate`.
2. **Thresholds** classify latency (warn / error) so “slow” is explicit.
3. **Sampling** keeps volume down for fast queries while still recording slow ones reliably.
4. **Pluggable logger** sends events through the same **pino** logger as the rest of the app (`lib/queryd-logger.ts`).

### Configuration used

| Parameter          | Value    | Rationale                                                     |
| ------------------ | -------- | ------------------------------------------------------------- |
| `warnThresholdMs`  | `200`    | Treat sub-200 ms as “normal” for small serverless queries     |
| `errorThresholdMs` | `1500`   | Escalate when user-visible latency is likely                  |
| `dbName`           | `'neon'` | Disambiguate in multi-DB or multi-env logs                    |
| `sampleRateNormal` | `0.05`   | ~5% of fast queries logged — enough for drift, not a firehose |
| `sampleRateSlow`   | `1`      | Always record queries that cross the warn threshold           |

---

## Implementation notes

### What is instrumented

All application SQL that goes through **tagged templates**:

```ts
const sql = getSql();
await sql`SELECT …`;
```

Blog and CV modules consistently use this style, so production paths are covered.

### What is not instrumented (in this app)

The Neon helper re-attaches `.query`, `.unsafe`, and `.transaction` from the **unwrapped** client for API compatibility. Any code that calls those methods directly bypasses queryd until wrapped similarly. This is an intentional trade-off: the codebase standardizes on `` sql`…` `` for application queries.

### Request context

This deployment does **not** call `runWithDbContext`, so **per-request query budgets** (`requestBudget` in the detector config) are not applied here. Adding budgets would mean wrapping each incoming request handler (or middleware) with `runWithDbContext({ requestId: … }, …)` — a natural next step if query storms become a concern.

---

## Outcomes

- **Actionable signals:** Slow or failing queries produce structured log lines with timing and DB name, aligned with the rest of the stack.
- **Low ceremony:** One dependency (`@olegkoval/queryd`), one wrapper module, one logger adapter.
- **Dogfooding:** The library author runs the same API surface in production, which keeps defaults and docs honest.

---

## Lessons learned

1. **Wrap where queries are born** — Centralizing `getSql()` avoids scattering instrumentation.
2. **Sampling is mandatory** at non-trivial QPS if you log “normal” queries at all.
3. **Tag budgets as phase two** — Single-query detection delivers value first; `runWithDbContext` + budgets catch N+1-style storms when you need them.

---

## See also

- [Request budgets](./budget.md) — background on `requestBudget` and `runWithDbContext`
- [README](../README.md) — full API and quick starts
