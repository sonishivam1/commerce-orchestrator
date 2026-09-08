---
paths:
  - "apps/api/**/*.ts"
  - "apps/worker-etl/**/*.ts"
---

# NestJS Backend Rules

## Module Structure
- Every feature module lives in `apps/api/src/modules/{feature}/` with its own `{feature}.module.ts`, `{feature}.service.ts`, `{feature}.resolver.ts`, and DTOs.
- `AppModule` imports the feature modules plus `DatabaseModule` (global), `QueueModule`, and the auth module.

## Authentication & Org scoping
- GraphQL resolvers MUST use `@UseGuards(GqlAuthGuard)` unless explicitly public (`login`, `register`). REST controllers use `@UseGuards(AuthGuard('jwt'))`.
- Get the principal with `@CurrentTenant()` / `@CurrentOrg()` — never parse the JWT by hand.
- `tenantId` (the organization id) scopes every service and repository call. `userId` / `role` identify the user; owner-only actions check `role === UserRole.OWNER` in the service.

## GraphQL
- Code-first via `@Resolver` / `@Query` / `@Mutation` with `autoSchemaFile: true`.
- Return types are `@ObjectType()` classes; inputs are `@InputType()`. Never return raw Mongoose documents.

## Worker (`apps/worker-etl`)
- One BullMQ processor on `QUEUE_ETL`, handling `MIGRATION_RUN` jobs only.
- The processor does infra only (pick up the job, delegate, handle throw). No Redlock.
- `MigrationRunOrchestrator` loads the run + project, decrypts credentials, orders the waves (`planEntityWaves`), and runs each via `WaveExecutorService` → `@cdo/core` `EtlEngine`.
- For `EXPORT`-mode runs the orchestrator builds a `FileExportTarget` from `@cdo/connectors` and writes the file; identity maps are skipped.

## Dependency Injection
- NestJS DI for all services. Never `new Service()` in a controller/resolver.
- `@cdo/db` repositories are `@Global()` and injectable everywhere.

## Error Handling
- Services throw NestJS exceptions (`BadRequestException`, `ForbiddenException`, …).
- The worker classifies errors with `ErrorType` and appends failures via `runRepository.appendFailedItem()` (→ `MigrationRun.failedItems[]`). No DLQ collection.
- Never swallow errors silently. Log with `tenantId` + `runId`.
