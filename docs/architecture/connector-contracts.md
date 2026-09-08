# Connector Contracts

Every platform integration implements one or both of these interfaces (defined in `@cdo/core`). Connectors hide API/SDK specifics; the pipeline only sees canonical data.

Instantiate connectors through `ConnectorFactory.createSource(platform, entityType)` / `createTarget(...)` — never `new` directly.

## SourceConnector

```typescript
export interface SourceConnector<TCanonical = CanonicalEntity> {
    /** Authenticate and validate credentials. Throws FATAL on bad config. */
    initialize(credentials: Record<string, unknown>): Promise<void>;

    /** Stream canonical entities in batches. `cursor` resumes a prior run. */
    extract(cursor?: string): AsyncIterableIterator<TCanonical[]>;

    /** Opaque pagination token for the last committed batch (resume support). */
    getCursor?(): string | undefined;
}
```

The source connector maps raw SDK objects to the canonical contract as it extracts, so `extract()` yields `CanonicalEntity[]` directly.

## TargetConnector

```typescript
export interface TargetConnector<TCanonical = CanonicalEntity> {
    /** Authenticate and validate credentials. Throws FATAL on bad config. */
    initialize(credentials: Record<string, unknown>): Promise<void>;

    /** Upsert a validated canonical batch. Returns per-item results. */
    load(entities: TCanonical[]): Promise<LoadResult[]>;
}

export interface LoadResult {
    sourceId: string;
    targetId: string;   // id assigned by the target platform
    status: 'created' | 'updated' | 'skipped';
}
```

The file-export destination is also a `TargetConnector` — `load()` appends canonical rows to the CSV/JSON output instead of calling a platform API.

## Guarantees

- **Idempotency.** `load()` MUST upsert (check-then-write, or a platform-native upsert / import API). A run that restarts at record 50,000 of 100,000 must not duplicate the first 50,000.
- **Streaming extraction.** `extract()` paginates natively and yields incrementally to bound memory.
- **No schema mutation.** Connectors move entities only. They do not create custom types, channels, or tax categories on the target (the old `PLATFORM_CLONE` / `deploySchema` / `getCapabilities` path is removed).
- **No `db` / `queue` / NestJS imports.** Connectors depend only on `@cdo/core` and `@cdo/shared`.
