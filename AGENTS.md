# Commerce Data Orchestrator

## Commands
```bash
pnpm run dev          # Start all apps in dev mode (Turborepo)
pnpm run build        # Build all apps and packages
pnpm run test         # Run tests across the monorepo
pnpm run lint         # Lint all packages
npx tsc --noEmit      # Type-check without emitting (run before committing)
docker compose up -d  # Start MongoDB (27017) + Redis (6379)
```

## Architecture
- **Monorepo**: PNPM 8 workspaces + Turborepo. Workspaces are `apps/*` and `packages/*`.
- **Language**: TypeScript 5.3, target ES2022, strict mode, `emitDecoratorMetadata` ON.
- **Apps**:
  - `apps/web` — Next.js App Router control panel. Uses `@cdo/ui` (shadcn) and `@cdo/gql` (Apollo).
  - `apps/api` — NestJS GraphQL control plane (code-first Apollo, `autoSchemaFile`).
  - `apps/worker-etl` — NestJS BullMQ consumer for ETL jobs.
  - `apps/worker-scrape` — NestJS BullMQ consumer for Playwright scrape jobs.
- **Packages** (dependency flows INWARD):
  - `@cdo/shared` — Canonical types, Zod validators, enums, constants. **Zero external deps.**
  - `@cdo/core` — Pure TS ETL engine (`EtlEngine`). Depends ONLY on `@cdo/shared`.
  - `@cdo/mapping` — Normalizers + rules engine. Depends on `@cdo/shared`.
  - `@cdo/connectors` — Platform SDK adapters (commercetools, Shopify). Depends on `@cdo/core`, `@cdo/mapping`, `@cdo/shared`.
  - `@cdo/ingestion` — Playwright scraper + parsers. Depends on `@cdo/core`, `@cdo/shared`.
  - `@cdo/db` — Mongoose schemas + tenant-scoped repositories. NestJS `@Global()` module.
  - `@cdo/queue` — BullMQ producers. Queue names come from `@cdo/shared/constants`.
  - `@cdo/auth` — JWT strategy, RBAC guards, `@CurrentTenant()` decorator.
  - `@cdo/redis` — Redis connection config.
  - `@cdo/ui` — shadcn/ui component library.
  - `@cdo/gql` — Apollo Client wrapper + GraphQL codegen hooks.
- **Infra**: MongoDB Atlas (Mongoose), Redis 7 (BullMQ + Redlock).

## Conventions

### Multi-Tenancy
- Every DB query MUST include `tenantId`. Repositories enforce this via scoped methods.
- `tenantId` is extracted from JWT `sub` claim by `JwtStrategy` in `@cdo/auth`.
- Use `@CurrentTenant()` decorator in resolvers to get the tenant.

### Data Contracts
- All entities flow through the **Universal Canonical Contract** (`CanonicalProduct`, `CanonicalCategory`, etc.).
- `Money.amount` is always integer (cents), never float.
- Locale fields are `Record<string, string>` maps, never bare strings.
- Runtime validation uses Zod schemas from `packages/shared/src/validators/`.

### Error Handling
- Three error types: `ValidationError`, `TransientError`, `FatalError` (from `ErrorType` enum).
- `ValidationError` — bad data, skip item, push to DLQ.
- `TransientError` — retryable (network timeout, rate limit). Exponential backoff.
- `FatalError` — trips the circuit breaker, halts the pipeline.
- Never use `console.log` or `console.error`. Use Pino structured logging.
- Never expose stack traces to API clients.

### Connectors
- Connectors must implement `SourceConnector<T>` or `TargetConnector<T>` interfaces from `@cdo/core`.
- Connectors MUST upsert, never blindly create (idempotency).
- Use `ConnectorFactory.createSource()` / `createTarget()` — never instantiate directly.
- All credentials are AES-256-GCM encrypted at rest, decrypted only in worker memory.

### Pipeline
- The `EtlEngine` accepts a `Source`, `Target`, and `EtlContext` (tenantId, jobId, correlationId, lockToken).
- Batch processing with `DEFAULT_BATCH_SIZE = 50`. Fallback to item-by-item on batch failure.
- Circuit breaker trips after `CIRCUIT_BREAKER_THRESHOLD = 10` consecutive non-validation failures.
- Workers delegate to an `Orchestrator` class — workers themselves only handle infra concerns (Redis polling, graceful shutdown).

### Naming
- Package aliases: `@cdo/shared`, `@cdo/core`, `@cdo/db`, etc. (defined in root `tsconfig.json` paths).
- Enums: `PascalCase` values with string backing (`JobKind.SCRAPE_IMPORT = 'SCRAPE_IMPORT'`).
- Files: `kebab-case` (`etl.engine.ts`, `ct-source.connector.ts`, `money.normalizer.ts`).
- Tests: colocated `__tests__/` dirs, named `*.spec.ts`.

## Watch out for
- `packages/core` must NEVER import from `@cdo/db`, `@cdo/queue`, or any NestJS module.
- Workers must NOT directly wire pipeline dependencies — the Orchestrator layer handles this.
- `apps/web` is excluded from the root `tsconfig.json` — it has its own.
- Queue names (`QUEUE_ETL`, `QUEUE_SCRAPE`) must match exactly between producers and consumers.
- Redlock key format: `lock:{tenantId}:{targetCredentialId}`, TTL = 30 min.
- GraphQL is code-first (NestJS decorators), not schema-first.

## Documentation
- Architecture docs: `docs/architecture/`
- Data models: `docs/data-models/`
- Operations: `docs/operations/`
- Implementation plans: `docs/implementation-plans/`
