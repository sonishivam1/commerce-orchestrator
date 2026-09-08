---
paths:
  - "packages/shared/**/*.ts"
  - "packages/db/**/*.ts"
  - "packages/queue/**/*.ts"
  - "packages/auth/**/*.ts"
  - "packages/redis/**/*.ts"
---

# Shared Infrastructure Rules

## `@cdo/shared` — The Foundation
- ZERO external dependencies. The leaf of the dependency graph.
- Canonical types in `models/canonical.types.ts`; Zod validators in `validators/`.
- Enums in `enums/index.ts`: `JobKind` (one value: `MIGRATION_RUN`), `Platform`, `EntityType`, `ErrorType`, `MigrationMode`, `ExportFormat`, `UserRole`, `MigrationProjectStatus`, `MigrationRunStatus`, `WaveStatus`, `ConnectionHealth`.
- Wave ordering helpers in `enums/index.ts`: `CANONICAL_ENTITY_ORDER`, `planEntityWaves()`, `entityWaveDependencies()` — a fixed list, not a topological sort.
- Constants in `constants.ts`: `QUEUE_ETL`, `DEFAULT_BATCH_SIZE = 50`, `MAX_JOB_RETRIES = 3`, `RETRY_BACKOFF_DELAY_MS`, `CANONICAL_VERSION`. No magic strings/numbers elsewhere.

## `@cdo/db` — Data Access
- Mongoose schemas in `schemas/`. Repositories in `repositories/` — every query method scopes by `tenantId` (the organization id).
- `DatabaseModule` is `@Global()`.
- Collections: `Tenant` (= organization), `User`, `Credential` (= connection), `MigrationProject`, `MigrationRun`, `IdentityMap`.
- `MigrationRun` embeds `waves[]`, `failedItems[]`, and `export` — there is NO separate DLQ or reconciliation collection.

## `@cdo/queue` — Job Producer
- `JobProducer.enqueueEtlJob()` — the only producer. Queue name `QUEUE_ETL = 'etl-queue'`.
- Retry config from constants (`MAX_JOB_RETRIES`, `RETRY_BACKOFF_DELAY_MS`).

## `@cdo/auth` — Authentication
- `JwtStrategy` returns `{ userId, tenantId, email, role }` (`sub` = userId, plus `tenantId` and `role` claims).
- `GqlAuthGuard` protects GraphQL resolvers; plain `AuthGuard('jwt')` protects REST controllers.
- `@CurrentTenant()` / `@CurrentOrg()` (aliases) inject `TenantContext` — `.tenantId` for scoping, `.userId` / `.role` for the user.
- `AuthModule` validates `JWT_SECRET` (min 32 chars) on startup.
