# Connector Contracts

All platform integrations (e.g., commercetools, Shopify) interact with the core ETL engine via standard Connector interfaces. Connectors abstract the underlying API complexities and adhere to strict contracts.

## Source Connector
The `SourceConnector` is responsible for fetching data from the origin platform.

```typescript
export interface SourceConnector<TRaw = any> {
    /** Initialize connection, authenticate, and validate credentials */
    initialize(credentials: Record<string, string>): Promise<void>;

    /** Extract data in batches using a generator to control memory footprint */
    extract(): AsyncGenerator<TRaw[]>;
}
```

## Target Connector
The `TargetConnector` is responsible for writing canonical data to the destination platform.

```typescript
export interface TargetConnector<TCanonical = any> {
    /** Initialize connection, authenticate, and validate credentials */
    initialize(credentials: Record<string, string>): Promise<void>;

    /** Load canonical entities in batches into the target platform */
    load(entities: TCanonical[]): Promise<LoadResult[]>;
}
```

## Key Guarantees
- **Idempotency**: All `load()` operations MUST be implemented as upserts. The Target Connector must never blindly create entities; it must check for existence or rely on platform-native upsert logic to ensure safe retries.
- **Stateless Extraction**: The `extract()` method should support pagination natively and yield data efficiently.
