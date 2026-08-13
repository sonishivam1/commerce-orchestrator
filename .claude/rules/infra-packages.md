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
- This package has ZERO external dependencies. It is the leaf of the dependency graph.
- All canonical types live in `models/canonical.types.ts`.
- All runtime validators live in `validators/` as Zod schemas.
- All enums live in `enums/index.ts`: `JobKind`, `JobStatus`, `Platform`, `ErrorType`.
- All constants live in `constants.ts`. Never use magic strings or raw numbers — import from here.
- Key constants: `QUEUE_ETL`, `QUEUE_SCRAPE`, `DEFAULT_BATCH_SIZE = 50`, `CIRCUIT_BREAKER_THRESHOLD = 10`, `LOCK_TTL_MS = 30min`, `MAX_JOB_RETRIES = 3`.

## `@cdo/db` — Data Access
- Mongoose schemas live in `schemas/`. Each has `tenantId` as a required indexed field.
- Repository classes live in `repositories/`. Every query method scopes by `tenantId`.
- `DatabaseModule` is `@Global()` — all schemas and repositories are available everywhere.
- Schemas: `Job`, `Credential`, `Tenant`, `DLQ`.
- DLQ repository methods: `create()`, `findAllForJob()`, `markReplayed()`, `findReplayableItems()`, `countPendingForJob()`.

## `@cdo/queue` — Job Producers
- `JobProducer` has `enqueueEtlJob()` and `enqueueScrapeJob()`.
- Queue names MUST match constants: `QUEUE_ETL = 'etl-queue'`, `QUEUE_SCRAPE = 'scrape-queue'`.
- Jobs include retry config from constants (`MAX_JOB_RETRIES`, `RETRY_BACKOFF_DELAY_MS`).

## `@cdo/auth` — Authentication
- `JwtStrategy` extracts `tenantId` from the `sub` claim.
- `GqlAuthGuard` protects GraphQL resolvers.
- `@CurrentTenant()` is a custom parameter decorator for resolvers.
- `AuthModule` validates `JWT_SECRET` env var exists and meets minimum length.
