---
paths:
  - "packages/core/**/*.ts"
  - "packages/mapping/**/*.ts"
  - "packages/connectors/**/*.ts"
---

# Pipeline & Connectors Rules

## Core Engine (`@cdo/core`)
- `EtlEngine` accepts a `SourceConnector`, a `TargetConnector`, and an `EtlContext`, plus optional `{ batchSize, maxRetries, onFatal }`.
- `EtlContext` carries: `tenantId`, `jobId`, `correlationId`, `sourceCredentials`, `targetCredentials`, optional `migrationProjectId` / `dryRun` / `startCursor`.
- Events: `progress` (successful batch results), `failure` (per-item errors), `complete`.
- Batch size 50; whole-batch failure falls back to item-by-item. Bounded retry via `withRetry`. NO circuit breaker.
- `@cdo/core` may only depend on `@cdo/shared` — never `@cdo/db`, `@cdo/queue`, `@cdo/auth`, or NestJS.

## Connector Rules
- Implement `SourceConnector<T>` or `TargetConnector<T>` from `@cdo/core`.
- `SourceConnector.extract(cursor?)` returns `AsyncIterableIterator<T[]>` and maps to canonical as it pages; optional `getCursor()` for resume.
- `TargetConnector.load(items)` returns `LoadResult[]` (per-item `{ key, success, targetId? }`) and MUST upsert, never blindly create.
- Platform connectors: `ConnectorFactory.createSource/createTarget(platform, entityType)` — never `new`.
- `FileExportTarget` (EXPORT mode) is the exception — not platform-keyed, instantiated directly by the worker orchestrator.
- No schema-mutation methods (`deploySchema` / `extractSchema`).

## Mapping (`@cdo/mapping`)
- Platform rules files: `shopify.rules.ts`, `commercetools.rules.ts` (no scrape).
- Normalizers: `money.normalizer.ts` (→ integer cents), `date.normalizer.ts` (→ ISO8601), `locale.normalizer.ts` (→ `Record<string,string>`).
- `ProductMapper.toCanonical()`: normalize → apply rules → Zod validate. On failure throw `ErrorType.VALIDATION`.
- `SourcePlatform` = `SHOPIFY | COMMERCETOOLS | BIGCOMMERCE`.

## Testing
- Colocated `__tests__/`, `*.spec.ts`. Mock connectors in engine tests — never hit real APIs.
- Every new mapper / normalizer / connector ships with at least one test.
