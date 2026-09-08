# Product Scope

This document defines what the Commerce Data Orchestrator **is** and — just as importantly — what it is **not**. It supersedes the earlier "MVP is commercetools → Shopify only" scope.

## What we are building

A hosted tool where a team can move product catalog data between commerce platforms.

A user can:

1. **Register their organization** and sign in. Multiple users belong to one organization and share its data.
2. **Add connections** — a connection is a set of platform credentials (Shopify, commercetools, or BigCommerce). Credentials are encrypted at rest. A connection can be health-checked.
3. **Create a migration project** — pick a source connection, the entity types to move, and either:
   - a **target connection** (mode `MIGRATE` — upsert into another platform), or
   - an **export format** (mode `EXPORT` — download the catalog as CSV or JSON).
4. **Run the project** — as a dry run (extract + transform + validate, no writes) or for real. Watch progress per entity type and see any failed items.
5. **Download** the export file, when the project is an export.

That is the whole product.

## Supported platforms

| Platform | Source | Target | Notes |
|---|---|---|---|
| commercetools | ✅ | ✅ | Full: categories, products, customers, orders |
| Shopify | ✅ | ✅ | Full: categories (collections), products, customers, orders |
| BigCommerce | ✅ products | ✅ products | Categories/customers/orders are follow-up work |
| File export | — | ✅ | CSV / JSON output of any supported entity |

## Supported entities

`CATEGORIES`, `PRODUCTS` (with variants, prices, inventory), `CUSTOMERS`, `ORDERS`.

Entities are processed in dependency order: categories → products, customers → orders.

## Explicitly out of scope

These were built or designed earlier and are being **removed** (see [00-simplification-plan.md](../implementation-plans/00-simplification-plan.md)):

| Removed | Why |
|---|---|
| Website scraping (`apps/worker-scrape`, `@cdo/ingestion`, Playwright) | Nobody asked to import from public HTML. |
| `PLATFORM_CLONE` topology (schema replication, `getCapabilities`, `deploySchema`) | commercetools→commercetools structural cloning is not a product goal. |
| Generic wave planner (Kahn topological sort) | The dependency order is 4 fixed entities. A hardcoded ordered list is enough. |
| Per-platform "rules engine" (`@cdo/mapping/rules-engine`) | Direct mapper functions cover every case. No generic transformation engine. |
| Reconciliation engine + `ReconciliationReport` + `/reports` UI | Count/parity verification is a future feature. Run counters are enough for now. |
| Dead-letter-queue subsystem (`DlqItem`, `dlq` module, `/dlq` UI, replay) | Failed items live on the run as an embedded list. |
| Redlock distributed locking | Only needed with multiple worker replicas. A `RUNNING` status flag guards single-worker deployments. |
| Redis-backed throttler + custom `RateLimitGuard` (alongside `ThrottlerModule`) | One in-memory throttler. |
| Circuit breaker in the core engine | Keep bounded retry with backoff; drop the breaker. |
| Canonical contract versioning (`_version`, downcast adapters) | Add when a second contract version actually exists. |
| Dual request tracing (`correlationId` + `traceId` + two interceptors) | One request id. |

> [!IMPORTANT]
> Do not reintroduce generic abstractions (workflow engines, rules engines, plugin systems, capability negotiation) speculatively. Add them only when a concrete second use case is in front of you.
