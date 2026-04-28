---
description: Scaffold a new platform connector (source + target) with proper interfaces and factory registration
argument-hint: [platform-name e.g. bigcommerce]
---

Create a new connector pair for the platform: **$ARGUMENTS**

## Steps
1. Create `packages/connectors/src/$ARGUMENTS/$ARGUMENTS-source.connector.ts`:
   - Implement `SourceConnector<CanonicalProduct>` from `@cdo/core`.
   - Implement `initialize(credentials)` for SDK client setup.
   - Implement `extract()` as an `AsyncGenerator<CanonicalProduct[]>` with cursor-based pagination.

2. Create `packages/connectors/src/$ARGUMENTS/$ARGUMENTS-target.connector.ts`:
   - Implement `TargetConnector<CanonicalProduct>` from `@cdo/core`.
   - Implement `initialize(credentials)` for SDK client setup.
   - Implement `load(items)` returning `LoadResult[]`. Must UPSERT, never blindly create.

3. Register both in `packages/connectors/src/connector.factory.ts`:
   - Add cases to `createSource()` and `createTarget()` switch statements.

4. Add the platform to `Platform` enum in `packages/shared/src/enums/index.ts` if not already present.

5. Create mapping rules in `packages/mapping/src/rules-engine/$ARGUMENTS.rules.ts`.

6. Create tests in `packages/connectors/src/__tests__/$ARGUMENTS.spec.ts`.

7. Export from `packages/connectors/src/index.ts`.
