---
paths:
  - "apps/api/**/*.ts"
  - "apps/worker-etl/**/*.ts"
  - "apps/worker-scrape/**/*.ts"
---

# NestJS Backend Rules

## Module Structure
- Every feature module lives in `apps/api/src/modules/{feature}/` with its own `{feature}.module.ts`, `{feature}.service.ts`, `{feature}.resolver.ts`, and DTOs.
- Modules register services, resolvers, and import `DatabaseModule` or `QueueModule` as needed.
- The `AppModule` imports all feature modules plus `DatabaseModule` (global), `QueueModule`, and `AuthModule`.

## Authentication & Tenancy
- All resolvers MUST use `@UseGuards(GqlAuthGuard)` unless the endpoint is explicitly public (e.g., login, register).
- Extract tenant context with the `@CurrentTenant()` decorator — never parse the JWT manually in resolvers.
- Pass `tenantId` from the resolver down to every service and repository call.

## GraphQL
- Schema is **code-first** via NestJS `@Resolver`, `@Query`, `@Mutation` decorators with `autoSchemaFile: true`.
- Return types are `@ObjectType()` classes. Inputs are `@InputType()` classes.
- Never return raw Mongoose documents — map them to GraphQL DTOs.

## Workers
- Workers are BullMQ processors that pull jobs from Redis queues (`QUEUE_ETL`, `QUEUE_SCRAPE`).
- Workers MUST NOT import `@cdo/mapping`, `@cdo/connectors`, or `@cdo/ingestion` directly. The `Orchestrator` class handles wiring.
- Workers are responsible for: polling Redis, decrypting credentials, acquiring Redlock, delegating to Orchestrator, releasing Redlock.
- The Orchestrator builds the pipeline context (`EtlContext`) and runs `EtlEngine`.

## Dependency Injection
- Use NestJS DI for all services. Never use `new Service()` inside controllers or resolvers.
- Repository classes from `@cdo/db` are injectable and `@Global()` — available across all modules.

## Error Handling
- Services must throw NestJS-compatible exceptions (`BadRequestException`, etc.) for API errors.
- Workers must classify errors using `ErrorType` enum and push failed items to the DLQ repository.
- Never swallow errors silently. Always log with context (tenantId, jobId).
