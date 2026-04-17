# Request budgets and database work per request

This document explains **what “budget” means** in reliability literature, **good practices** for limiting database work per application request, and **how queryd’s `requestBudget` feature** fits in (with links to sources).

## Terminology: three different “budgets”

| Concept | Typical meaning | Relationship to queryd |
| -------- | ---------------- | ------------------------ |
| **SRE error budget** | Allowed rate of **SLO misses** (e.g. availability or latency objectives); used to balance reliability vs change velocity. | **Not the same thing.** queryd does not compute SLO compliance or error budgets. See [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) and [Embracing Risk](https://sre.google/sre-book/embracing-risk/) (motivation for error budgets). |
| **End-user / latency budget** | Share of total request time allocated to each hop (browser, CDN, app, DB) so the **overall** request stays within a target. | queryd’s `maxTotalDurationMs` is an **aggregate DB time per `requestId`**, not a full end-to-end latency budget—but it aligns with the idea of capping how much wall-clock time DB work can consume inside one logical request. Monitoring guidance often groups **latency** with other “golden signals” ([Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)). |
| **Per-request DB budget (this library)** | Optional caps on **how many SQL round-trips** and/or **total measured DB duration** apply to one **`requestId`** before emitting a **`db.request.budget`** event. | This is what `requestBudget` implements. It is **observability and alerting**, not a hard stop: queries still run unless **you** add policy on top of events. |

## How queryd request budgets work

Configure `requestBudget` on `SlowQueryDetectorConfig`:

- **`maxQueries`** — maximum number of completed `executeQuery` calls (success or error) per `requestId`.
- **`maxTotalDurationMs`** — maximum **sum** of per-query durations for that `requestId`.
- **`maxTrackedRequests`** — LRU size for in-memory state (default 5000).

Behavior (see [README § Request budgets](../README.md#request-budgets-per-requestid)):

1. Budgets apply only when **`requestId`** is set on context (e.g. via `runWithDbContext`). With **`createSlowQueryDetector`**, the default `contextProvider` reads that context; custom detectors must supply one (see [README](../README.md#request-budgets-per-requestid)).
2. Each query completion increments **count** and adds **duration** to that `requestId`.
3. The **first** time either limit is exceeded, sinks receive **one** `RequestBudgetViolationEvent` (`event: "db.request.budget"`). Further violations for the same id only happen after that id is evicted from the LRU map.
4. **`LoggerSink`** logs budget events at **warn** level (see `LoggerSink` in source).

This design targets **query storms**: many fast queries that never cross a single-query `warnThresholdMs`, but still hurt latency, CPU, and pool usage.

## Industry context: why cap queries or cost per operation?

- **N+1 patterns** — One initial query plus N per-row queries is a classic ORM issue; each subquery may be “fast” while the pattern is still pathological. See [Handling the N+1 problem](https://www.apollographql.com/docs/graphos/schema-design/guides/handling-n-plus-one) (GraphQL/API layer) and [Performance](https://graphql.org/learn/performance/) (batching, lookahead, and related ideas).
- **Operation cost limits** — GraphQL ecosystems often use **complexity** or **depth** limits so a single client operation cannot do unbounded work ([Operation complexity controls](https://graphql-js.org/docs/operation-complexity-controls/)). That is **static analysis of the operation**; queryd instead measures **actual** round-trips and time at runtime for the instrumented client.
- **SLO thinking** — Services define SLIs (e.g. latency) and SLOs; teams use **error budgets** to tolerate a controlled rate of misses ([Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)). Per-request DB caps are a **narrow, implementable signal** that your app’s data layer is not exploding for a single request—complementary to service-level SLOs.

## Good practices for `requestBudget` limits

1. **Baseline before tightening** — Use existing metrics (p50/p95 query count and DB time per route) or staging load tests. Pick limits that **rarely fire** in healthy traffic and **do fire** when N+1 or fan-out bugs appear.
2. **Different routes, different budgets** — Read-heavy list endpoints may legitimately use more queries than a simple mutation; if you use one process-wide detector config, choose limits that fit your **worst acceptable** “normal” path or use separate detector instances per surface if needed.
3. **Pair with single-query thresholds** — `warnThresholdMs` / `errorThresholdMs` catch **slow individual** queries; `requestBudget` catches **many small** queries. Use both.
4. **Treat violations as signals** — Wire `db.request.budget` to your log/metrics backend (e.g. Sentry, Datadog) and alert with **low noise**: one event per `requestId` per violation window keeps cardinality manageable.
5. **Remember process boundaries** — Tracking is **in-process** and keyed by `requestId`. It does not aggregate across app instances; for cluster-wide enforcement you still need shared counters or edge limits.
6. **Memory** — Adjust `maxTrackedRequests` if you have very high concurrency of unique ids.

## How this feature helps users

| User goal | How queryd helps |
| ---------- | ----------------- |
| Find **N+1** or accidental fan-out | Many queries stay under per-query ms thresholds but **trip `maxQueries`** or **`maxTotalDurationMs`**, producing a structured **`db.request.budget`** event with counts and totals. |
| **Alert** without parsing every query log | One **warn-level** (or custom sink) event per offending `requestId` reduces noise versus logging every query. |
| **Correlate** to traffic | Events include **`requestId`** and optional **`userId`** (from context) for support and debugging. |
| **Integrate** with existing observability | Custom **`IEventSink`** implementations can route `event === "db.request.budget"` to metrics, tickets, or paging ([README](../README.md#request-budgets-per-requestid)). |

**Non-goals:** queryd does not **reject** or **cancel** queries when a budget is exceeded; it **observes** and **emits**. Hard enforcement requires application or database-layer controls in addition to this library.

## References (URLs)

- Google SRE Book — [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) (SLIs, SLOs, error budgets).
- Google SRE Book — [Embracing Risk](https://sre.google/sre-book/embracing-risk/) (motivation for error budgets).
- Google SRE Book — [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) (latency, traffic, and alerting philosophy).
- Apollo GraphQL — [Handling the N+1 problem](https://www.apollographql.com/docs/graphos/schema-design/guides/handling-n-plus-one).
- GraphQL — [Performance](https://graphql.org/learn/performance/).
- GraphQL.js — [Operation complexity controls](https://graphql-js.org/docs/operation-complexity-controls/).

---

*Package: [@olegkoval/queryd](https://www.npmjs.com/package/@olegkoval/queryd) · Repo README: [Request budgets](../README.md#request-budgets-per-requestid).*
