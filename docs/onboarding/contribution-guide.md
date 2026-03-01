# Contribution Guide

## Respecting Boundaries
Before writing any code, review the [Dependency Graph](../architecture/dependency-graph.md) documentation. 
* Do not import `nestjs` code into the `core` extraction engine. 
* Do not write Shopify-specific checks in the `core` mapping engine.

## Adding a New Platform Connector
1. Navigate to `packages/connectors/src/my-platform`.
2. Create `client.ts` implementing raw SDK initialization.
3. Create `source.ts` implementing `SourceConnector<TCanonical>`. Ensure `extract()` is an AsyncGenerator.
4. Create `target.ts` implementing `TargetConnector<TCanonical>`. Ensure `load()` handles rate limits gracefully.
5. Export them from the package `index.ts`.
6. Navigate to `apps/worker-etl`, inject your new connector into the Connector Factory mappings, so the API can dispatch jobs towards it.

## Code Standards
* **No Global State**: Variables caching must happen strictly bound to a `class` instantiation.
* **Return Early**: Avoid nested `if/else` statements.
* **Zod Schemas**: If you change a Canonical interface in `@repo/shared`, you must also update its `.schema.ts` counterpart.

## Testing
Run all unit tests across the monorepo:
```bash
pnpm turbo run test
```
