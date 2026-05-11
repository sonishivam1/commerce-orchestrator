# Sub-Plan: Phase 1 — Commercetools Target Connector + Reverse Mapping

> **Status:** AWAITING APPROVAL  
> **Priority:** 🔴 High — End-to-end pipeline cannot complete without this  
> **Depends on:** Phase 0 (done), Phase 1 source connectors (done), `@cdo/mapping` rules engine (done)  
> **Blocks:** Any real data migration landing in a target platform  
> **Skill references:** `.claude/skills/connector-development/SKILL.md`, `.claude/skills/canonical-mapping/SKILL.md`  
> **Agent:** `pipeline-architect`

---

## Problem Statement

The CT target connector's `load()` method currently throws immediately:

```typescript
throw new Error('Target mutation not fully implemented: Requires ProductType & Category resolution');
```

`ProductMapper.fromCanonical()` also throws `'not implemented'`. This means:

- **No migration job can ever land data** in commercetools, regardless of how well extraction works.
- The Shopify target connector has the same gap (addressed separately — lower priority since CT is the primary target).

The reverse mapping (`CanonicalProduct → CT ProductDraft`) requires:
1. A reverse rules function in `@cdo/mapping`
2. `ProductMapper.fromCanonical()` wired per-platform
3. `ct-target.connector.ts` `load()` calling the CT Products API (upsert by `key`)

---

## Acceptance Criteria

- [ ] `ProductMapper.fromCanonical(canonical, 'COMMERCETOOLS')` returns a valid CT `ProductDraft`
- [ ] `CommercetoolsTargetConnector.load(batch)` calls the CT API — upserts by `key` (create if missing, update if exists)
- [ ] Each item returns a `LoadResult` with `success: true` and `targetId` on success
- [ ] On per-item CT API error: returns `LoadResult` with `success: false, error: message` — does NOT throw
- [ ] `ProductMapper.fromCanonical()` for SHOPIFY platform also implemented (basic — title, handle, variants)
- [ ] Unit test: `fromCanonical` for CT produces correct ProductDraft shape
- [ ] Unit test: `CommercetoolsTargetConnector.load()` with mocked CT client — success + error paths
- [ ] `npx tsc --noEmit` = 0 errors

---

## Files to Change

### CREATE

| File | Purpose |
|------|---------|
| `packages/mapping/src/rules-engine/ct-reverse.rules.ts` | `CanonicalProduct → CT ProductDraft` transformation |
| `packages/mapping/src/rules-engine/shopify-reverse.rules.ts` | `CanonicalProduct → Shopify ProductInput` transformation |
| `packages/connectors/src/__tests__/ct-target.connector.spec.ts` | Unit tests for CT target load() |
| `packages/mapping/src/__tests__/reverse-mapping.spec.ts` | Unit tests for fromCanonical() |

### MODIFY

| File | Change |
|------|--------|
| `packages/mapping/src/mappers/product.mapper.ts` | Implement `fromCanonical()` using reverse rules per platform |
| `packages/connectors/src/commercetools/ct-target.connector.ts` | Implement `load()` with real CT API upsert |
| `packages/connectors/src/shopify/shopify-target.connector.ts` | Implement `load()` with real Shopify API upsert |

---

## Implementation Detail

### 1. CT Reverse Rules (`ct-reverse.rules.ts`)

`CanonicalProduct` → CT `ProductDraft` format for the Products API:

```typescript
// packages/mapping/src/rules-engine/ct-reverse.rules.ts
import type { CanonicalProduct, CanonicalVariant } from '@cdo/shared';

export interface CtProductDraft {
    key: string;
    productType: { typeId: 'product-type'; key: string };
    name: Record<string, string>;
    description?: Record<string, string>;
    slug: Record<string, string>;
    masterVariant: CtVariantDraft;
    variants: CtVariantDraft[];
    publish: boolean;
    categories?: Array<{ typeId: 'category'; key: string }>;
}

export interface CtVariantDraft {
    sku: string;
    prices?: CtPriceDraft[];
    images?: CtImageDraft[];
    attributes?: CtAttribute[];
}

export interface CtPriceDraft {
    value: { type: 'centPrecision'; currencyCode: string; centAmount: number; fractionDigits: number };
}

export interface CtImageDraft {
    url: string;
    label?: string;
    dimensions?: { w: number; h: number };
}

export interface CtAttribute {
    name: string;
    value: unknown;
}

const DEFAULT_PRODUCT_TYPE_KEY = 'default-product-type';

const mapVariant = (v: CanonicalVariant): CtVariantDraft => ({
    sku: v.sku,
    prices: v.prices.map(p => ({
        value: {
            type: 'centPrecision',
            currencyCode: p.currencyCode,
            centAmount: p.centAmount,
            fractionDigits: p.fractionDigits ?? 2,
        },
    })),
    images: v.images.map(url => ({ url })),
    attributes: Object.entries(v.attributes).map(([name, value]) => ({ name, value })),
});

export const mapCanonicalToCtDraft = (canonical: CanonicalProduct): CtProductDraft => ({
    key: canonical.key,
    productType: {
        typeId: 'product-type',
        key: (canonical.customAttributes?.productType as string) ?? DEFAULT_PRODUCT_TYPE_KEY,
    },
    name: canonical.name,
    description: Object.keys(canonical.description).length > 0 ? canonical.description : undefined,
    slug: canonical.slug,
    masterVariant: mapVariant(canonical.masterVariant),
    variants: canonical.variants.map(mapVariant),
    publish: canonical.isPublished,
    categories: canonical.categoryKeys.map(key => ({ typeId: 'category', key })),
});
```

**Key decisions:**
- `productType.key` falls back to `'default-product-type'` — the target CT project must have this product type. Jobs can override via `customAttributes.productType`.
- Categories are mapped by `key`, not `id` — the target project must have matching category keys (created by `PLATFORM_CLONE` schema phase).
- Prices map `centAmount` directly — already integers in canonical form, no conversion needed.

---

### 2. Shopify Reverse Rules (`shopify-reverse.rules.ts`)

```typescript
// packages/mapping/src/rules-engine/shopify-reverse.rules.ts
import type { CanonicalProduct } from '@cdo/shared';

export interface ShopifyProductInput {
    title: string;
    body_html: string;
    handle: string;
    status: 'active' | 'draft' | 'archived';
    vendor?: string;
    tags?: string;
    variants: ShopifyVariantInput[];
}

export interface ShopifyVariantInput {
    sku: string;
    price: string;   // Shopify takes string price in major units
    inventory_quantity?: number;
}

const DEFAULT_LOCALE = 'en';

export const mapCanonicalToShopifyInput = (canonical: CanonicalProduct): ShopifyProductInput => {
    const title = canonical.name[DEFAULT_LOCALE] ?? Object.values(canonical.name)[0] ?? canonical.key;
    const body = canonical.description[DEFAULT_LOCALE] ?? Object.values(canonical.description)[0] ?? '';
    const handle = canonical.slug[DEFAULT_LOCALE] ?? Object.values(canonical.slug)[0] ?? canonical.key;

    return {
        title,
        body_html: body,
        handle,
        status: canonical.isPublished ? 'active' : 'draft',
        vendor: canonical.customAttributes?.vendor as string | undefined,
        tags: canonical.categoryKeys.join(', '),
        variants: [canonical.masterVariant, ...canonical.variants].map(v => ({
            sku: v.sku,
            price: String((v.prices[0]?.centAmount ?? 0) / 100),
            inventory_quantity: v.stockQuantity,
        })),
    };
};
```

---

### 3. `ProductMapper.fromCanonical()` — Wire Reverse Rules

```typescript
// packages/mapping/src/mappers/product.mapper.ts — updated fromCanonical()
import { mapCanonicalToCtDraft } from '../rules-engine/ct-reverse.rules';
import { mapCanonicalToShopifyInput } from '../rules-engine/shopify-reverse.rules';

fromCanonical(canonical: CanonicalProduct): unknown {
    switch (this.platform) {
        case SourcePlatform.COMMERCETOOLS:
            return mapCanonicalToCtDraft(canonical);
        case SourcePlatform.SHOPIFY:
            return mapCanonicalToShopifyInput(canonical);
        default:
            const error = new Error(`fromCanonical not supported for platform: ${this.platform}`);
            (error as any).type = ErrorType.FATAL;
            throw error;
    }
}
```

---

### 4. `CommercetoolsTargetConnector.load()` — Real API Upsert

```typescript
// packages/connectors/src/commercetools/ct-target.connector.ts — updated load()
import { ProductMapper, SourcePlatform } from '@cdo/mapping';
import type { CtProductDraft } from '@cdo/mapping';

private readonly mapper = new ProductMapper(SourcePlatform.COMMERCETOOLS);

async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
    const results: LoadResult[] = [];

    for (const item of batch) {
        try {
            const draft = this.mapper.fromCanonical(item) as CtProductDraft;

            // Try to find existing product by key
            let targetId: string;
            try {
                const existing = await this.client
                    .products()
                    .withKey({ key: item.key })
                    .get()
                    .execute();

                // Product exists — build update actions
                const actions = this.buildUpdateActions(existing.body, draft);
                const updated = await this.client
                    .products()
                    .withKey({ key: item.key })
                    .post({
                        body: {
                            version: existing.body.version,
                            actions,
                        },
                    })
                    .execute();

                targetId = updated.body.id;
            } catch (notFound: any) {
                if (notFound.statusCode === 404) {
                    // Product does not exist — create it
                    const created = await this.client
                        .products()
                        .post({ body: draft })
                        .execute();
                    targetId = created.body.id;
                } else {
                    throw notFound;
                }
            }

            results.push({ key: item.key, success: true, targetId });

        } catch (error: any) {
            results.push({
                key: item.key,
                success: false,
                error: error.message ?? String(error),
            });
        }
    }

    return results;
}

private buildUpdateActions(
    existing: any,
    draft: CtProductDraft,
): Array<{ action: string; [k: string]: unknown }> {
    const actions: Array<{ action: string; [k: string]: unknown }> = [];

    // Name change
    if (JSON.stringify(existing.masterData?.current?.name) !== JSON.stringify(draft.name)) {
        actions.push({ action: 'changeName', name: draft.name });
    }

    // Slug change
    if (JSON.stringify(existing.masterData?.current?.slug) !== JSON.stringify(draft.slug)) {
        actions.push({ action: 'changeSlug', slug: draft.slug });
    }

    // Description
    if (draft.description) {
        actions.push({ action: 'setDescription', description: draft.description });
    }

    // Publish / unpublish
    const isPublished = existing.masterData?.published ?? false;
    if (draft.publish && !isPublished) {
        actions.push({ action: 'publish' });
    } else if (!draft.publish && isPublished) {
        actions.push({ action: 'unpublish' });
    }

    return actions;
}
```

**Key decisions:**
- Upsert pattern: GET by key → 404 = create, 200 = update. This is idempotent and safe to retry.
- Update actions are minimal — only changed fields. Full variant sync is out of scope for v1 (variant management requires more complex CT action sets).
- Per-item try/catch: one item failure does NOT abort the batch — returns `LoadResult` with `success: false`.

---

### 5. `ShopifyTargetConnector.load()` — Real API Upsert

Uses Shopify Admin REST API (`PUT /admin/api/{version}/products/{id}.json`):

```typescript
async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
    const results: LoadResult[] = [];

    for (const item of batch) {
        try {
            const input = this.mapper.fromCanonical(item) as ShopifyProductInput;

            // Search for existing product by handle (handle = slug, unique in Shopify)
            const searchRes = await fetch(
                `https://${this.shopDomain}/admin/api/${this.apiVersion}/products.json?handle=${input.handle}&fields=id`,
                { headers: { 'X-Shopify-Access-Token': this.accessToken } }
            );
            const searchData = await searchRes.json();
            const existing = searchData.products?.[0];

            let targetId: string;
            if (existing) {
                const res = await fetch(
                    `https://${this.shopDomain}/admin/api/${this.apiVersion}/products/${existing.id}.json`,
                    {
                        method: 'PUT',
                        headers: {
                            'X-Shopify-Access-Token': this.accessToken,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ product: input }),
                    }
                );
                const data = await res.json();
                targetId = String(data.product.id);
            } else {
                const res = await fetch(
                    `https://${this.shopDomain}/admin/api/${this.apiVersion}/products.json`,
                    {
                        method: 'POST',
                        headers: {
                            'X-Shopify-Access-Token': this.accessToken,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ product: input }),
                    }
                );
                const data = await res.json();
                targetId = String(data.product.id);
            }

            results.push({ key: item.key, success: true, targetId });

        } catch (error: any) {
            results.push({ key: item.key, success: false, error: error.message });
        }
    }

    return results;
}
```

---

## Test Plan

### `reverse-mapping.spec.ts`

| Test | Input | Expected Output |
|------|-------|-----------------|
| CT: valid canonical → CT draft | Full `CanonicalProduct` | `draft.key` matches, `draft.name` = locale map, `draft.masterVariant.prices[0].value.centAmount` = integer |
| CT: empty categoryKeys | `categoryKeys: []` | `draft.categories = []` |
| CT: customAttributes.productType override | `customAttributes.productType = 'clothing'` | `draft.productType.key = 'clothing'` |
| Shopify: valid canonical → Shopify input | Full `CanonicalProduct` | `input.title` = en name, `input.status = 'active'` if `isPublished` |
| Unsupported platform | `SourcePlatform.SCRAPER` | Throws with `ErrorType.FATAL` |

### `ct-target.connector.spec.ts`

| Test | Mock | Expected |
|------|------|----------|
| load() — product not found (404) → creates | CT client throws 404 on GET | `results[0].success = true`, `results[0].targetId` set |
| load() — product exists → updates | CT client returns existing product | Update action called, `results[0].success = true` |
| load() — CT API error | CT client throws 500 | `results[0].success = false`, `results[0].error` set |
| load() — batch of 3: one fails | Mixed responses | Returns 3 results, partial success |

---

## Out of Scope for This Plan

- Full variant sync in CT update (complex action sets — deferred to v2)
- BigCommerce target connector
- `extractSchema()` / `deploySchema()` for PLATFORM_CLONE (separate sub-plan)
- Shopify rate-limit handling (429 retry — handled by `TransientError` + EtlEngine retry)
