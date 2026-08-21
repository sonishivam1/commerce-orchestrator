# Phase 2: Wave Executor + BullMQ Wiring

**Status**: APPROVED  
**Agent**: implementation-executor  
**Date**: 2026-08-21

---

## Problem Statement

Phase 1 established the domain model (MigrationProject, MigrationRun, IdentityMap, ReconciliationReport) and the GraphQL API. Phase 2 connects that domain model to actual execution: when `createMigrationRun` is called, a BullMQ job is enqueued, the worker picks it up, plans waves in dependency order, runs `EtlEngine` per wave, writes `IdentityMap` entries after each batch, and finally generates a `ReconciliationReport`.

The critical correctness proof: a Category migrated in Wave 1 must be resolvable to its Shopify Collection ID when Wave 2 (Products) needs to set `collectionId`. The IdentityMap is the bridge.

---

## Acceptance Criteria

- [ ] `createMigrationRun` mutation enqueues a `MIGRATION_RUN` BullMQ job
- [ ] Worker picks up the job and marks the MigrationRun RUNNING
- [ ] Waves execute in dependency order: CATEGORIES → PRODUCTS → CUSTOMERS → ORDERS
- [ ] After each batch, successful `LoadResult.targetId` values are written to IdentityMap via `bulkUpsert`
- [ ] Before PRODUCTS wave, CATEGORIES resolution map is loaded from IdentityMap and passed to target connector
- [ ] `dryRun=true` skips all `target.load()` calls but extract + transform still runs
- [ ] Each wave's status is updated in `MigrationRun.waves[]` (PENDING → RUNNING → COMPLETED/FAILED)
- [ ] On wave failure, MigrationRun is marked FAILED with error summary
- [ ] On success, a `ReconciliationReport` is generated and persisted
- [ ] `npx tsc --noEmit` passes — zero type errors
- [ ] Golden path test passes: CT Category → IdentityMap → CT Product with resolved Shopify ID
- [ ] Wave planner unit tests pass (dependency graph, topological sort)

---

## Files to Change

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `packages/shared/src/enums/index.ts` | Add `MIGRATION_RUN` to `JobKind` |
| CREATE | `packages/core/src/wave/wave-dependency.ts` | Pure dependency graph (EntityType → deps) |
| CREATE | `packages/core/src/wave/wave-planner.ts` | Topological sort → ordered EntityType[] |
| CREATE | `packages/core/src/wave/dry-run-target.connector.ts` | No-op target connector for dryRun |
| CREATE | `packages/core/src/wave/index.ts` | Wave package exports |
| MODIFY | `packages/core/src/index.ts` | Export wave utilities |
| MODIFY | `packages/queue/src/producers/job.producer.ts` | Add `MIGRATION_RUN` kind + `migrationRunId` + `dryRun` to payload |
| MODIFY | `packages/db/src/repositories/identity-map.repository.ts` | `bulkUpsert` returns `{ created, updated }` counts |
| CREATE | `apps/worker-etl/src/orchestrator/wave-executor.service.ts` | Wave execution: EtlEngine per wave + IdentityMap wiring |
| CREATE | `apps/worker-etl/src/orchestrator/migration-run.orchestrator.ts` | Run-level coordinator: plan waves, call executor, generate report |
| MODIFY | `apps/worker-etl/src/processors/etl/etl.processor.ts` | Route `MIGRATION_RUN` to `MigrationRunOrchestrator` |
| MODIFY | `apps/worker-etl/src/processors/etl/etl-processor.module.ts` | Add `WaveExecutorService`, `MigrationRunOrchestrator` |
| MODIFY | `apps/api/src/modules/migration-project/migration-project.service.ts` | Enqueue BullMQ job in `createRun()` |
| MODIFY | `apps/api/src/modules/migration-project/migration-project.module.ts` | Import `QueueModule` for `JobProducer` |
| CREATE | `packages/core/src/wave/__tests__/wave-planner.spec.ts` | Unit tests: dep graph + topological sort |
| CREATE | `apps/worker-etl/src/orchestrator/__tests__/wave-executor.service.spec.ts` | Golden path + dryRun tests |

---

## Implementation Detail

### Wave Dependency Graph (MVP)

```
CATEGORIES → []          (no dependencies)
PRODUCTS   → [CATEGORIES]
CUSTOMERS  → []
ORDERS     → [CUSTOMERS]
```

Selected entity types are topologically sorted. If a user selects only PRODUCTS and CATEGORIES, the sort produces [CATEGORIES, PRODUCTS]. If they select only ORDERS, no CUSTOMERS dependency is run (it was not selected).

### Resolution Map Propagation

Before each wave, the executor loads the IdentityMap for each dependency entity type:

```typescript
const resolutionMaps: Record<string, Record<string, string>> = {};
for (const dep of dependencies) {
    const map = await identityMapRepo.getResolutionMap(tenantId, migrationProjectId, dep);
    resolutionMaps[dep] = Object.fromEntries(map);
}
```

These are injected into `targetCredentials` under the key `__identityMaps`. Target connectors retrieve this during `initialize()`. This avoids any interface changes to `TargetConnector`.

### IdentityMap Write-back (progress handler)

```typescript
engine.on('progress', async (results) => {
    const entries = results
        .filter(r => r.success && r.targetId)
        .map(r => ({ tenantId, migrationProjectId, entityType, sourceKey: r.key, targetId: r.targetId! }));
    if (entries.length > 0) {
        const counts = await identityMapRepo.bulkUpsert(entries);
        created += counts.created;
        updated += counts.updated;
    }
});
```

### dryRun

`DryRunTargetConnector<T>` wraps any `TargetConnector<T>`. Its `load()` returns a successful `LoadResult` for each item without calling the real platform. `targetId` is set to `dry-run:{item.key}` so the IdentityMap is also skipped (no real IDs).

The wave executor checks `context.dryRun` and wraps the real connector before passing to EtlEngine.

### ReconciliationReport Generation

After all waves complete:
```typescript
const summaries = await Promise.all(
    project.entityTypes.map(async (entityType) => {
        const migratedCount = await identityMapRepo.countForEntityType(tenantId, migrationProjectId, entityType);
        const wave = run.waves.find(w => w.entityType === entityType);
        return {
            entityType,
            sourceCount: (wave?.processedCount ?? 0) + (wave?.failedCount ?? 0),
            migratedCount,
            createdCount: waveStats[entityType]?.created ?? 0,
            updatedCount: waveStats[entityType]?.updated ?? 0,
            failedCount: wave?.failedCount ?? 0,
            missingRefCount: waveStats[entityType]?.missingRef ?? 0,
        };
    })
);
```

---

## Test Plan

### `wave-planner.spec.ts`
- Full dependency set [CATEGORIES, PRODUCTS, CUSTOMERS, ORDERS] → sorted order
- Subset [PRODUCTS, CATEGORIES] → [CATEGORIES, PRODUCTS]
- Single [CATEGORIES] → [CATEGORIES]
- Single [ORDERS] → [ORDERS] (no CUSTOMERS auto-added — only selected types are sorted)

### `wave-executor.service.spec.ts`
- **Golden path**: Mock CT source yields one Category. Mock Shopify target returns `targetId = 'shopify-collection-123'`. After engine.run(), IdentityMap.bulkUpsert() is called with `{sourceKey: 'ct-electronics', targetId: 'shopify-collection-123'}`. Second wave for PRODUCTS receives `__identityMaps.CATEGORIES` containing that mapping.
- **dryRun**: DryRunTargetConnector is used; bulkUpsert is NOT called (no real targetIds)
- **Wave failure**: When engine throws, wave is marked FAILED, run is marked FAILED

---

## Out of Scope

- Cursor-based resume (cursor field is populated but not used to restart extraction — Phase 3)
- BigCommerce connector (MVP is CT → Shopify only)
- Real Shopify/CT API calls in tests (all mocked)
- Connection health testing endpoint
- Streaming wave progress via GraphQL subscriptions
