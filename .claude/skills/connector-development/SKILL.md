---
name: connector-development
description: Platform connector implementation skill for Commerce Data Orchestrator. Encodes the SourceConnector and TargetConnector interfaces, ConnectorFactory registration, pagination patterns, upsert semantics, and credential initialization. Invoke when adding a new platform or modifying existing connectors.
user-invocable: true
---

# Connector Development Skill — Commerce Data Orchestrator

## Connector Architecture

```
ConnectorFactory
    ├── createSource(platform) → SourceConnector<T>
    └── createTarget(platform) → TargetConnector<T>

SourceConnector<T>                    TargetConnector<T>
├── initialize(credentials)           ├── initialize(credentials)
└── extract(): AsyncGenerator<T[]>    └── load(items: T[]): LoadResult[]
```

---

## SourceConnector Interface

```typescript
// packages/core/src/interfaces/source-connector.interface.ts
export interface SourceConnector<T extends CanonicalEntity> {
    /** Initialize SDK client with decrypted credentials */
    initialize(credentials: Record<string, unknown>): Promise<void>;

    /**
     * Extract entities as paginated batches.
     * MUST yield arrays — the engine handles batching internally.
     * Use cursor-based pagination, not offset.
     */
    extract(): AsyncGenerator<T[]>;
}
```

### Source Connector Template

```typescript
// packages/connectors/src/[platform]/[platform]-source.connector.ts
import type { SourceConnector } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { ProductMapper } from '@cdo/mapping';

export class [Platform]SourceConnector implements SourceConnector<CanonicalProduct> {
    private client: [Platform]Client;
    private readonly mapper = new ProductMapper('[platform]');

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        this.client = new [Platform]Client({
            apiKey: credentials.apiKey as string,
            storeUrl: credentials.storeUrl as string,
        });
    }

    async *extract(): AsyncGenerator<CanonicalProduct[]> {
        let cursor: string | undefined;
        const PAGE_SIZE = 100;

        do {
            const response = await this.client.products.list({
                limit: PAGE_SIZE,
                after: cursor,
            });

            const canonical = response.items.map(item =>
                this.mapper.toCanonical(item)
            );

            yield canonical;

            cursor = response.nextCursor;
        } while (cursor);
    }
}
```

---

## TargetConnector Interface

```typescript
// packages/core/src/interfaces/target-connector.interface.ts
export interface TargetConnector<T extends CanonicalEntity> {
    /** Initialize SDK client with decrypted credentials */
    initialize(credentials: Record<string, unknown>): Promise<void>;

    /**
     * Load entities into the target platform.
     * MUST upsert — never blindly create (idempotency requirement).
     * Return one LoadResult per input item.
     */
    load(items: T[]): Promise<LoadResult[]>;
}

export interface LoadResult {
    key: string;       // CanonicalEntity.key — unique identifier
    success: boolean;
    targetId?: string; // Platform-specific ID after upsert
    error?: string;    // Error message if success=false
}
```

### Target Connector Template

```typescript
// packages/connectors/src/[platform]/[platform]-target.connector.ts
import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { ProductMapper } from '@cdo/mapping';

export class [Platform]TargetConnector implements TargetConnector<CanonicalProduct> {
    private client: [Platform]Client;
    private readonly mapper = new ProductMapper('[platform]');

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        this.client = new [Platform]Client({
            apiKey: credentials.apiKey as string,
            storeUrl: credentials.storeUrl as string,
        });
    }

    async load(items: CanonicalProduct[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];

        for (const item of items) {
            try {
                // MUST upsert — check if exists first, then create or update
                const platformData = this.mapper.fromCanonical(item);
                const existing = await this.client.products.findByKey(item.key);

                if (existing) {
                    await this.client.products.update(existing.id, platformData);
                } else {
                    await this.client.products.create(platformData);
                }

                results.push({ key: item.key, success: true });
            } catch (error: any) {
                results.push({
                    key: item.key,
                    success: false,
                    error: error.message,
                });
            }
        }

        return results;
    }
}
```

---

## ConnectorFactory Registration

```typescript
// packages/connectors/src/connector.factory.ts
import { [Platform]SourceConnector } from './[platform]/[platform]-source.connector';
import { [Platform]TargetConnector } from './[platform]/[platform]-target.connector';

export class ConnectorFactory {
    static createSource(platform: string): SourceConnector<CanonicalEntity> {
        switch (platform) {
            case 'commercetools': return new CommercetoolsSourceConnector();
            case 'shopify':      return new ShopifySourceConnector();
            case '[platform]':   return new [Platform]SourceConnector(); // ADD HERE
            default: throw new Error(`Unsupported source platform: ${platform}`);
        }
    }

    static createTarget(platform: string): TargetConnector<CanonicalEntity> {
        switch (platform) {
            case 'commercetools': return new CommercetoolsTargetConnector();
            case 'shopify':      return new ShopifyTargetConnector();
            case '[platform]':   return new [Platform]TargetConnector(); // ADD HERE
            default: throw new Error(`Unsupported target platform: ${platform}`);
        }
    }
}
```

---

## Credential Patterns by Platform

```typescript
// Commercetools
{ projectKey: string, clientId: string, clientSecret: string, apiUrl: string, authUrl: string }

// Shopify
{ shopDomain: string, accessToken: string, apiVersion: string }

// BigCommerce
{ storeHash: string, accessToken: string, clientId: string }
```

---

## Pagination Patterns

```typescript
// CORRECT — cursor-based (resumable, consistent under writes)
async *extract(): AsyncGenerator<CanonicalProduct[]> {
    let cursor: string | undefined;
    do {
        const page = await this.client.list({ after: cursor, limit: 100 });
        yield this.mapBatch(page.items);
        cursor = page.nextCursor;
    } while (cursor);
}

// WRONG — offset-based (skips/duplicates under concurrent writes)
for (let offset = 0; ; offset += 100) {
    const page = await this.client.list({ offset, limit: 100 });
    // BAD — items shift if products are added/deleted during pagination
}
```

---

## Checklist When Adding a New Connector

- [ ] Implements `SourceConnector<T>` or `TargetConnector<T>` from `@cdo/core`
- [ ] Added to `ConnectorFactory` switch statements
- [ ] Platform added to `Platform` enum in `@cdo/shared/enums`
- [ ] Mapping rules created in `@cdo/mapping/rules-engine/`
- [ ] Source uses cursor-based pagination (not offset)
- [ ] Target upserts (checks exists → update or create)
- [ ] `initialize()` accepts generic `Record<string, unknown>` credentials
- [ ] Never imports from `@cdo/db` or NestJS modules
- [ ] Unit tests in `packages/connectors/src/__tests__/`
- [ ] Exported from `packages/connectors/src/index.ts`
