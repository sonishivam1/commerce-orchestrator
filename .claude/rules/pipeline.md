---
paths:
  - "packages/core/**/*.ts"
  - "packages/mapping/**/*.ts"
  - "packages/connectors/**/*.ts"
  - "packages/ingestion/**/*.ts"
---

# Pipeline & Connectors Rules

## Core Engine (`@cdo/core`)
- The `EtlEngine` class is the heart of all job execution. It accepts `SourceConnector`, `TargetConnector`, and `EtlContext`.
- `EtlContext` carries: `tenantId`, `jobId`, `correlationId`, `lockToken`, `sourceCredentials`, `targetCredentials`.
- The engine emits typed events: `progress` (batch results), `failure` (per-item errors), `complete`.
- `@cdo/core` must NEVER import from `@cdo/db`, `@cdo/queue`, `@cdo/auth`, or any NestJS module.
- `@cdo/core` may only depend on `@cdo/shared`.

## Connector Rules
- All connectors implement `SourceConnector<T>` or `TargetConnector<T>` from `@cdo/core/interfaces`.
- `SourceConnector.extract()` must return `AsyncGenerator<T[]>` (paginated batches).
- `TargetConnector.load(items: T[])` must return `LoadResult[]` with per-item success/failure.
- Both interfaces have `initialize(credentials)` — called by the engine before extract/load.
- Use `ConnectorFactory` to instantiate connectors — never `new CommercetoolsSourceConnector()` directly.
- Target connectors MUST upsert, never blindly create.

## Mapping Rules
- Each platform has a rules file: `shopify.rules.ts`, `commercetools.rules.ts`, `scrape.rules.ts`.
- Rules transform platform-specific SDK objects into `CanonicalProduct` (or other canonical types).
- Normalizers handle cross-cutting concerns: `money.normalizer.ts` (string→cents), `date.normalizer.ts` (any→ISO8601), `locale.normalizer.ts` (flatten to `Record<string, string>`).
- `ProductMapper.toCanonical()` orchestrates: normalize → apply rules → Zod validate.
- On Zod validation failure, throw a typed error with `ErrorType.VALIDATION`.

## Ingestion Rules
- `ScraperService` uses real Playwright with concurrency pooling and stealth headers.
- `PageExtractor` handles DOM extraction. `ProductParser` parses JSON-LD structured data.
- `ScrapeSourceConnector` bridges `ScraperService` to the `SourceConnector` interface.

## Testing
- Unit tests live in `__tests__/` directories colocated with source.
- Mock `SourceConnector` and `TargetConnector` in engine tests — never hit real APIs.
- Test files are named `*.spec.ts`.
