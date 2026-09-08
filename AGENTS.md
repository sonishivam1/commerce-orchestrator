# Commerce Data Orchestrator

## Direction (read first)

The project is being simplified to exactly one product: a hosted tool where an
organization signs up, adds encrypted platform connections (Shopify,
commercetools, BigCommerce), and runs **migration projects** that either move
catalog data to another platform or export it to a CSV/JSON file.

- Product boundary: `docs/architecture/migration-scope.md`
- Current design: `docs/architecture/system-overview.md`, `docs/architecture/run-lifecycle.md`, `docs/data-models/schemas.md`
- Teardown/build plan: `docs/implementation-plans/00-simplification-plan.md`

**Being removed** — do not build on or extend these: `apps/worker-scrape`,
`@cdo/ingestion`, `@cdo/mapping` rules-engine, the legacy `Job` model + `job`
module + `data-etl.orchestrator`, `PLATFORM_CLONE`, the `wave-planner` Kahn sort,
`ReconciliationReport` + `/reports`, the `DlqItem` subsystem + `/dlq`, Redlock,
the custom Redis throttler, the core circuit breaker, canonical `_version`,
dual `correlationId`+`traceId` tracing.

When code and these docs disagree, the docs describe the target; check
`00-simplification-plan.md` for what has been done.

## Commands
```bash
pnpm run dev          # Start all apps in dev mode (Turborepo)
pnpm run build        # Build all apps and packages
pnpm run test         # Run tests across the monorepo
pnpm run lint         # Lint all packages
npx tsc --noEmit      # Type-check without emitting (run before committing)
docker compose up -d  # Start MongoDB (27017) + Redis (6379)
```

## Architecture (target)
- **Monorepo**: PNPM 8 workspaces + Turborepo. Workspaces are `apps/*` and `packages/*`.
- **Language**: TypeScript 5.3, target ES2022, strict mode, `emitDecoratorMetadata` ON.
- **Apps**:
  - `apps/web` — Next.js App Router dashboard. Uses `@cdo/ui` (shadcn) and `@cdo/gql` (Apollo).
  - `apps/api` — NestJS GraphQL control plane (code-first Apollo, `autoSchemaFile`). Never imports `@cdo/core` or `@cdo/connectors`.
  - `apps/worker` — single NestJS BullMQ consumer for `MIGRATION_RUN` jobs. (Currently named `apps/worker-etl`.)
- **Packages** (dependency flows INWARD):
  - `@cdo/shared` — Canonical types, Zod validators, enums, constants. **Zero external deps.**
  - `@cdo/core` — Pure TS pipeline (`EtlEngine`, bounded retry). Depends ONLY on `@cdo/shared`. No NestJS/Mongoose/BullMQ.
  - `@cdo/connectors` — commercetools / Shopify / BigCommerce source + target adapters, canonical mappers/normalizers, file-export target. Depends on `@cdo/core`, `@cdo/shared`. Never imports `@cdo/db`.
  - `@cdo/db` — Mongoose schemas + org-scoped repositories. NestJS `@Global()` module.
  - `@cdo/queue` — BullMQ producer + Redis connection. Queue name from `@cdo/shared/constants`.
  - `@cdo/auth` — JWT strategy, guard, `@CurrentOrg()` decorator.
  - `@cdo/ui` — shadcn/ui component library.
  - `@cdo/gql` — Apollo Client wrapper + GraphQL codegen hooks.
- **Infra**: MongoDB (Mongoose), Redis 7 (BullMQ only).

## Conventions

### Org scoping (multi-tenancy)
- `tenantId` = the organization id. Every DB query MUST be scoped by it; repositories enforce this.
- A `users` collection holds people; each user has a `tenantId` and a `role` (`OWNER` | `MEMBER`).
- JWT payload: `{ sub: userId, tenantId, role }`. Use `@CurrentOrg()` in resolvers to get `{ userId, tenantId, role }`.
- Registration creates an organization + its first `OWNER` user together.

### Data contracts
- All entities flow through the **Universal Canonical Contract** (`CanonicalProduct`, `CanonicalCategory`, etc.).
- `Money` amounts are always integer cents, never float.
- Locale fields are `Record<string, string>` maps, never bare strings.
- Runtime validation uses Zod schemas from `packages/shared/src/validators/`.
- No canonical contract versioning — one shape.

### Error handling
- Three error types from `ErrorType`: `VALIDATION`, `TRANSIENT`, `FATAL`.
- `VALIDATION` — bad data. Skip the item, append to `MigrationRun.failedItems[]`, continue.
- `TRANSIENT` — retryable (timeout, rate limit). Bounded exponential backoff; then treat as a failed item.
- `FATAL` — misconfiguration. Stop the wave, mark the run `FAILED`.
- No circuit breaker, no DLQ collection.
- Never `console.log` / `console.error`. Use Pino structured logging.
- Never expose stack traces to API clients.

### Connectors
- Implement `SourceConnector<T>` / `TargetConnector<T>` from `@cdo/core`.
- `load()` MUST upsert, never blindly create (idempotency).
- Use `ConnectorFactory.createSource()` / `createTarget()` — never instantiate directly.
- Credentials are AES-256-GCM encrypted at rest, decrypted only in worker memory.
- No schema-mutation methods (`getCapabilities` / `deploySchema`).

### Pipeline
- `EtlEngine` accepts a Source, a Target, and an `EtlContext` (`tenantId`, `runId`, `requestId`).
- Batch size 50. Fall back to item-by-item on batch failure.
- Entity order is the fixed constant `CATEGORIES → PRODUCTS → CUSTOMERS → ORDERS`, filtered to the project's selection. No topological sort.
- The worker's orchestrator wires dependencies; the worker itself only handles infra (queue polling, graceful shutdown).

### Naming
- Package aliases: `@cdo/shared`, `@cdo/core`, etc. (root `tsconfig.json` paths).
- Enums: `PascalCase` values with string backing (`JobKind.MIGRATION_RUN = 'MIGRATION_RUN'`).
- Files: `kebab-case` (`etl.engine.ts`, `ct-source.connector.ts`).
- Tests: colocated `__tests__/` dirs, named `*.spec.ts`.

## Watch out for
- `@cdo/core` must NEVER import `@cdo/db`, `@cdo/queue`, or any NestJS module.
- `@cdo/connectors` must NEVER import `@cdo/db`.
- `apps/api` must NEVER import `@cdo/core` or `@cdo/connectors`.
- `apps/web` is excluded from the root `tsconfig.json` — it has its own.
- The BullMQ queue name must match exactly between the producer (`@cdo/queue`) and `apps/worker`.
- Concurrency guard is a `RUNNING` status check on the project — not Redlock.
- GraphQL is code-first (NestJS decorators), not schema-first.

## Documentation
- Index: `docs/README.md`
- Architecture: `docs/architecture/` · Data models: `docs/data-models/` · Operations: `docs/operations/`
- Superseded design docs: `docs/archive/`
