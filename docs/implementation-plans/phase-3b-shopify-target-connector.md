# Phase 3B — Shopify Target Connector: Golden Path Completion

**Status**: AWAITING APPROVAL  
**Agent**: pipeline-architect  
**Skill**: connector-development

---

## Problem Statement

The Shopify target connector exists but cannot complete the CT → Shopify golden path because:

1. **`targetId` is never returned** — every `LoadResult` has `success: true` but no `targetId`.  
   The wave executor's IdentityMap write-back filters `r => r.targetId`, so no category, product,
   or customer mapping is ever persisted. The cross-entity resolution pipeline (Categories first →
   Products resolve collection IDs) is therefore broken end-to-end.

2. **Two mutation argument bugs** — `collectionCreate(collection: $input)` and
   `collectionUpdate(collection: $input)` use the wrong argument name; Shopify's Admin API
   expects `(input: $input)`. These would return HTTP 200 with a `null` collection and a
   userErrors array on every call against a real store.

3. **No identity map injection** — `initialize()` discards `credentials.__identityMaps`.
   Products need `__identityMaps[CATEGORIES]` to resolve `categoryKeys` → Shopify collection
   GIDs so they can populate `collectionsToJoin` on the ProductInput.

4. **Orders not supported** — `load()` throws for `EntityType.ORDERS`.  
   CT orders have `customerKey`, `lineItems`, and `totalPrice`. These need to map to Shopify
   draft orders with a resolved `customerId` from `__identityMaps[CUSTOMERS]`.

---

## Acceptance Criteria

- [ ] `loadCategories()` returns `targetId: "gid://shopify/Collection/..."` on success
- [ ] `loadProducts()` returns `targetId: "gid://shopify/Product/..."` on success
- [ ] `loadProducts()` includes `collectionsToJoin` with resolved collection GIDs when
      `__identityMaps[CATEGORIES]` is present in credentials
- [ ] `loadCustomers()` returns `targetId: "gid://shopify/Customer/..."` on success
- [ ] `loadOrders()` creates Shopify draft orders and returns
      `targetId: "gid://shopify/DraftOrder/..."` on success
- [ ] `loadOrders()` populates `customerId` from `__identityMaps[CUSTOMERS]` when available
- [ ] `collectionCreate` and `collectionUpdate` mutations use `input:` (not `collection:`)
- [ ] All `userErrors` are classified as `ErrorType.VALIDATION`; HTTP 429 as `TRANSIENT`;
      all other HTTP errors as `TRANSIENT`
- [ ] Per-item isolation: one item's failure does not abort the rest of the batch
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Unit tests cover: category upsert + targetId, product upsert + collectionsToJoin +
      targetId, customer upsert + targetId, order create + customer resolution + targetId,
      error classification

---

## Files to Change

| File | Action | Purpose |
|------|--------|---------|
| `packages/connectors/src/shopify/shopify-target.connector.ts` | MODIFY | Fix all four gaps |
| `packages/connectors/src/shopify/__tests__/shopify-target.connector.spec.ts` | CREATE | Unit tests |

No schema changes. No new NestJS modules. No queue changes.

---

## Implementation Detail

### 1. New private fields + initialize()

```typescript
export class ShopifyTargetConnector implements TargetConnector<CanonicalEntity> {
    private shopUrl!: string;
    private accessToken!: string;
    private locationId?: string;
    /**
     * Resolved identity maps injected by the wave executor via credentials.__identityMaps.
     * Key: EntityType string (e.g. 'CATEGORIES').
     * Value: Map of sourceKey → targetId (e.g. 'ct-electronics' → 'gid://shopify/Collection/123').
     */
    private identityMaps: Record<string, Record<string, string>> = {};

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const { shopName, accessToken, locationId, __identityMaps } = credentials;
        // ... existing validation ...
        this.identityMaps = (__identityMaps as Record<string, Record<string, string>>) ?? {};
    }
}
```

### 2. Fix collection mutations (argument name bug)

```graphql
# WRONG (current)
mutation CollectionCreate($input: CollectionInput!) {
    collectionCreate(collection: $input) { ... }
}

# CORRECT
mutation CollectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
        collection { id handle }
        userErrors { field message }
    }
}

mutation CollectionUpdate($input: CollectionInput!) {
    collectionUpdate(input: $input) {
        collection { id handle }
        userErrors { field message }
    }
}
```

### 3. upsertCategory returns GID

```typescript
private async upsertCategory(canonical: CanonicalCategory): Promise<string> {
    const input = canonicalToShopifyCategoryInput(canonical);
    const handle = (input.handle as string) || canonical.key;

    const findData = await this.execute(FIND_COLLECTION_BY_HANDLE, { handle }) as {
        collectionByHandle?: { id: string } | null;
    };
    const existingId = findData.collectionByHandle?.id;

    if (existingId) {
        const mutData = await this.execute(COLLECTION_UPDATE, { input: { ...input, id: existingId } }) as any;
        this.assertNoUserErrors(mutData.collectionUpdate, canonical.key);
        return mutData.collectionUpdate.collection?.id ?? existingId;
    } else {
        const mutData = await this.execute(COLLECTION_CREATE, { input }) as any;
        this.assertNoUserErrors(mutData.collectionCreate, canonical.key);
        return mutData.collectionCreate.collection!.id;
    }
}

private async loadCategories(batch: CanonicalCategory[]): Promise<LoadResult[]> {
    return Promise.all(batch.map(async (canonical) => {
        try {
            const targetId = await this.upsertCategory(canonical);
            return { key: canonical.key, success: true, targetId };
        } catch (error) {
            const typed = classifyShopifyError(error);
            return { key: canonical.key, success: false, error: typed.message };
        }
    }));
}
```

### 4. upsertProduct with collectionsToJoin

```typescript
private async upsertProduct(canonical: CanonicalProduct): Promise<string> {
    const handle = Object.values(canonical.slug)[0] || canonical.key;

    const findData = await this.execute(FIND_PRODUCT_BY_HANDLE, { handle }) as {
        productByHandle?: { id: string } | null;
    };
    const existingId = findData.productByHandle?.id;

    // Resolve canonical categoryKeys → Shopify collection GIDs via identity maps
    const categoryMap = this.identityMaps[EntityType.CATEGORIES] ?? {};
    const collectionsToJoin = canonical.categoryKeys
        .map(key => categoryMap[key])
        .filter(Boolean) as string[];

    const input = canonicalToShopifyProductInput(canonical, existingId, this.locationId);
    // Inject resolved collection IDs into the ProductInput
    if (collectionsToJoin.length > 0) {
        input.collectionsToJoin = collectionsToJoin;
    }

    const mutation = existingId ? PRODUCT_UPDATE : PRODUCT_CREATE;
    const operationKey = existingId ? 'productUpdate' : 'productCreate';

    const mutData = await this.execute(mutation, { input }) as Record<
        string,
        { product: { id: string } | null; userErrors: Array<{ field: string[]; message: string }> }
    >;
    this.assertNoUserErrors(mutData[operationKey], canonical.key);
    return mutData[operationKey].product!.id;
}

private async loadProducts(batch: CanonicalProduct[]): Promise<LoadResult[]> {
    return Promise.all(batch.map(async (canonical) => {
        try {
            const targetId = await this.upsertProduct(canonical);
            return { key: canonical.key, success: true, targetId };
        } catch (error) {
            const typed = classifyShopifyError(error);
            return { key: canonical.key, success: false, error: typed.message };
        }
    }));
}
```

### 5. upsertCustomer returns GID

```typescript
private async upsertCustomer(canonical: CanonicalCustomer): Promise<string> {
    const findData = await this.execute(FIND_CUSTOMER_BY_EMAIL, {
        query: `email:${canonical.email}`,
    }) as { customers: { edges: Array<{ node: { id: string } }> } };

    const existingId = findData.customers.edges[0]?.node?.id;
    const input = canonicalToShopifyCustomerInput(canonical, existingId);

    if (existingId) {
        const mutData = await this.execute(CUSTOMER_UPDATE, { input }) as any;
        this.assertNoUserErrors(mutData.customerUpdate, canonical.key);
        return mutData.customerUpdate.customer?.id ?? existingId;
    } else {
        const mutData = await this.execute(CUSTOMER_CREATE, { input }) as any;
        this.assertNoUserErrors(mutData.customerCreate, canonical.key);
        return mutData.customerCreate.customer!.id;
    }
}

private async loadCustomers(batch: CanonicalCustomer[]): Promise<LoadResult[]> {
    return Promise.all(batch.map(async (canonical) => {
        try {
            const targetId = await this.upsertCustomer(canonical);
            return { key: canonical.key, success: true, targetId };
        } catch (error) {
            const typed = classifyShopifyError(error);
            return { key: canonical.key, success: false, error: typed.message };
        }
    }));
}
```

### 6. Order loading via draftOrderCreate

```graphql
mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
        draftOrder { id name }
        userErrors { field message }
    }
}
```

```typescript
// CanonicalOrder shape (inline from CT connector — no dedicated type yet)
interface CanonicalOrderLike extends CanonicalEntity {
    customerKey?: string;
    lineItems: Array<{
        productKey?: string;
        variantSku?: string;
        quantity: number;
        unitPrice: { centAmount: number; currencyCode: string; fractionDigits: number };
    }>;
    totalPrice: { centAmount: number; currencyCode: string; fractionDigits: number };
    currency: string;
    status: string;
}

private async upsertOrder(canonical: CanonicalOrderLike): Promise<string> {
    const customerMap = this.identityMaps[EntityType.CUSTOMERS] ?? {};
    const customerId = canonical.customerKey
        ? customerMap[canonical.customerKey]
        : undefined;

    // Map line items as custom line items (no Shopify variantId available at this stage)
    const lineItems = canonical.lineItems.map(li => ({
        title: li.variantSku ?? li.productKey ?? 'Unknown Item',
        quantity: li.quantity,
        originalUnitPrice: (
            li.unitPrice.centAmount / Math.pow(10, li.unitPrice.fractionDigits)
        ).toFixed(li.unitPrice.fractionDigits),
    }));

    const input: Record<string, unknown> = {
        lineItems,
        currency: canonical.currency,
        note: `Migrated from source order: ${canonical.key}`,
        tags: [`source-key:${canonical.key}`],
    };

    if (customerId) input.customerId = customerId;

    const mutData = await this.execute(DRAFT_ORDER_CREATE, { input }) as any;
    this.assertNoUserErrors(mutData.draftOrderCreate, canonical.key);
    return mutData.draftOrderCreate.draftOrder!.id;
}

private async loadOrders(batch: CanonicalOrderLike[]): Promise<LoadResult[]> {
    return Promise.all(batch.map(async (canonical) => {
        try {
            const targetId = await this.upsertOrder(canonical);
            return { key: canonical.key, success: true, targetId };
        } catch (error) {
            const typed = classifyShopifyError(error);
            return { key: canonical.key, success: false, error: typed.message };
        }
    }));
}
```

### 7. Updated load() switch

```typescript
async load(batch: CanonicalEntity[]): Promise<LoadResult[]> {
    switch (this.entityType) {
        case EntityType.PRODUCTS:
            return this.loadProducts(batch as CanonicalProduct[]);
        case EntityType.CATEGORIES:
            return this.loadCategories(batch as CanonicalCategory[]);
        case EntityType.CUSTOMERS:
            return this.loadCustomers(batch as CanonicalCustomer[]);
        case EntityType.ORDERS:
            return this.loadOrders(batch as CanonicalOrderLike[]);
        default: {
            const err = new Error(`Unsupported entity type for Shopify target: ${this.entityType}`);
            (err as any).type = ErrorType.VALIDATION;
            throw err;
        }
    }
}
```

---

## Test Plan

File: `packages/connectors/src/shopify/__tests__/shopify-target.connector.spec.ts`

Mock strategy: `jest.mock('node-fetch')` with `mockResolvedValue` for the `fetch` function,
returning JSON-serialised Shopify GraphQL responses.

Tests to write:

**Categories**
1. `upsert creates new collection → returns collection GID as targetId`
2. `upsert updates existing collection → returns GID`
3. `userErrors on create → LoadResult.success=false, error contains detail`
4. `mutation uses correct argument name (input:, not collection:)`

**Products**
5. `upsert creates new product → returns product GID`
6. `categoryKeys resolved via __identityMaps → collectionsToJoin included in input`
7. `no categoryKeys → collectionsToJoin omitted from input`
8. `userErrors → LoadResult.success=false`

**Customers**
9. `upsert creates new customer → returns customer GID`
10. `existing customer found by email → update called, returns GID`

**Orders**
11. `creates draft order → returns draftOrder GID`
12. `customerKey resolved from __identityMaps → customerId set in DraftOrderInput`
13. `missing customerKey → order created without customerId`

**Error handling**
14. `HTTP 429 → ErrorType.TRANSIENT`
15. `HTTP 422 → ErrorType.VALIDATION`
16. `per-item isolation: one item fails, others succeed`

---

## Out of Scope

- Shopify source connector changes
- CanonicalOrder Zod validator / dedicated type (orders stay as inline shape)
- Product variant → Shopify variant GID resolution (variant IdentityMap is Phase 4)
- BigCommerce connector
- Completing existing CT target connector
- GQL control-plane surface (Phase 3A)
- Frontend changes

---

## Skill References

- `.claude/skills/connector-development` (loaded)
- `.claude/rules/reverse-mapping.md`
- `.claude/rules/pipeline.md`
