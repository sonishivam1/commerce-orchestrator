> [!WARNING]
> **Archived / superseded.** This document describes the pre-simplification design.
> See [docs/architecture/migration-scope.md](../architecture/migration-scope.md) and
> [docs/implementation-plans/00-simplification-plan.md](../implementation-plans/00-simplification-plan.md)
> for the current design. Kept for historical context only.

# Sub-Plan 01 — Full Platform Architectural Fix

**Status: COMPLETE** (User directive: "act as senior architect and do things accordingly")  
**Agent: implementation-executor**  
**Date: 2026-08-17**  
**Completed: 2026-08-21** — EntityType enum, multi-entity orchestrator loop, ConnectorFactory platform strings, CT source productProjections fix all verified via smoke test

---

## Problem Statement

The commerce-orchestrator codebase has several critical issues that prevent it from working at all in production:

1. **CRITICAL BUG — Platform string mismatch**: `Platform.COMMERCETOOLS = 'commercetools'` (shared enum, stored in DB) vs `SourcePlatform.COMMERCETOOLS = 'COMMERCETOOLS'` (mapping enum, used in ConnectorFactory switch). Every ETL job throws "Unsupported source platform" immediately.

2. **MISSING FEATURE — No entity type selection**: Users cannot specify what to migrate. The pipeline always migrates products only, regardless of intent. No `entityTypes` field exists on the Job schema or CreateJobInput.

3. **MISSING FEATURE — Single-entity extraction only**: CT and Shopify source connectors only implement product extraction. Category, customer, and order extraction is not wired.

4. **MISSING FEATURE — Export has no download path**: EXPORT jobs write JSONL to local disk. No API endpoint or UI affordance exists to retrieve the file.

5. **CODE QUALITY — console.log/error in connectors**: Source connectors use `console.error` instead of proper error classification, violating project logging rules.

6. **INCOMPLETE — CategoryMapper/CustomerMapper.fromCanonical() not implemented**: Target connectors cannot load categories or customers.

---

## Acceptance Criteria

- [ ] `ConnectorFactory.createSource('commercetools')` returns a `CommercetoolsSourceConnector` (not throws)
- [ ] `ConnectorFactory.createSource('shopify')` returns a `ShopifySourceConnector`
- [ ] `ConnectorFactory.createSource('bigcommerce')` returns a `BigCommerceSourceConnector`
- [ ] `EntityType` enum exists in `@cdo/shared` with PRODUCTS, CATEGORIES, CUSTOMERS, ORDERS values
- [ ] `Job` Mongoose schema has `entityTypes: string[]` field
- [ ] `CreateJobInput` has `entityTypes: EntityType[]` field
- [ ] CT source connector extracts products, categories, customers based on `entityType`
- [ ] Shopify source connector extracts products, categories, customers based on `entityType`
- [ ] CT target connector loads products, categories, customers
- [ ] DataEtlOrchestrator runs one EtlEngine pass per requested entity type
- [ ] Job creation wizard shows entity type selection UI
- [ ] `Job` schema stores `exportFilePath` after EXPORT completion
- [ ] No `console.log`/`console.error` in connector files
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Files to Change

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `packages/shared/src/enums/index.ts` | Add `EntityType` enum |
| MODIFY | `packages/core/src/engine/etl.engine.ts` | Add `entityTypes` to `EtlContext` |
| MODIFY | `packages/mapping/src/mappers/product.mapper.ts` | Fix `SourcePlatform` values to lowercase; add BIGCOMMERCE |
| MODIFY | `packages/mapping/src/mappers/category.mapper.ts` | Implement `fromCanonical()` for CT and Shopify |
| MODIFY | `packages/mapping/src/mappers/customer.mapper.ts` | Implement `fromCanonical()` for CT and Shopify |
| MODIFY | `packages/connectors/src/connector.factory.ts` | Add `entityType` param; update platform strings |
| MODIFY | `packages/connectors/src/commercetools/ct-source.connector.ts` | Add category/customer extraction; remove console.error |
| MODIFY | `packages/connectors/src/shopify/shopify-source.connector.ts` | Add category/customer extraction; remove console.error |
| MODIFY | `packages/connectors/src/commercetools/ct-target.connector.ts` | Add category/customer load methods |
| MODIFY | `packages/connectors/src/shopify/shopify-target.connector.ts` | Add category/customer load methods |
| MODIFY | `packages/db/src/schemas/job.schema.ts` | Add `entityTypes`, `exportFilePath` fields |
| MODIFY | `packages/queue/src/producers/job.producer.ts` | Add `entityTypes` to `EtlJobPayload` |
| MODIFY | `apps/api/src/modules/job/dto/create-job.input.ts` | Add `entityTypes` field |
| MODIFY | `apps/api/src/modules/job/dto/job.type.ts` | Add `EntityType` enum, `entityTypes` field |
| MODIFY | `apps/api/src/modules/job/job.service.ts` | Pass `entityTypes` to queue |
| MODIFY | `apps/worker-etl/src/processors/etl/etl.processor.ts` | Pass `entityTypes` from job data |
| MODIFY | `apps/worker-etl/src/orchestrator/data-etl.orchestrator.ts` | Loop entity types, create per-type connectors |
| MODIFY | `apps/web/components/jobs/new-job-form.tsx` | Add entity type selection step |

---

## Implementation Detail

### 1. SourcePlatform Fix (packages/mapping)
```typescript
export enum SourcePlatform {
    SHOPIFY = 'shopify',           // was 'SHOPIFY'
    COMMERCETOOLS = 'commercetools', // was 'COMMERCETOOLS'
    BIGCOMMERCE = 'bigcommerce',   // new
    SCRAPER = 'scraper',           // was 'SCRAPER'
}
```

### 2. EntityType Enum (packages/shared)
```typescript
export enum EntityType {
    PRODUCTS = 'PRODUCTS',
    CATEGORIES = 'CATEGORIES',
    CUSTOMERS = 'CUSTOMERS',
    ORDERS = 'ORDERS',
}
```

### 3. ConnectorFactory Update
```typescript
static createSource(platform: string, entityType: EntityType = EntityType.PRODUCTS) {
    switch (platform) {
        case SourcePlatform.COMMERCETOOLS:
            return new CommercetoolsSourceConnector(entityType);
        case SourcePlatform.SHOPIFY:
            return new ShopifySourceConnector(entityType);
        case SourcePlatform.BIGCOMMERCE:
            return new BigCommerceSourceConnector(entityType);
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}
```

### 4. Orchestrator Multi-Entity Loop
```typescript
const entityTypes = config.entityTypes ?? [EntityType.PRODUCTS];
for (const entityType of entityTypes) {
    const source = ConnectorFactory.createSource(sourcePlatform, entityType);
    const target = ConnectorFactory.createTarget(targetPlatform, entityType);
    const engine = new EtlEngine(source, target, context);
    engine.on('progress', ...);
    engine.on('failure', ...);
    await engine.run();
}
```

---

## Test Plan

- Existing `product.mapper.spec.ts` and `mapping.spec.ts` must continue to pass
- `SourcePlatform.COMMERCETOOLS === 'commercetools'` — can be verified in existing tests

---

## Out of Scope

- Orders extraction (CT orders API has complex data model; deferred)
- BigCommerce category/customer extraction (only CT and Shopify for now)
- Real-time WebSocket progress (polling sufficient for v1)
- Cloud storage for EXPORT files (local disk path stored in Job for v1)
