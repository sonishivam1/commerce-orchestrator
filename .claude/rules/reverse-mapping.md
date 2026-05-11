---
paths:
  - "packages/mapping/**/*.ts"
  - "packages/connectors/**/*.ts"
---

# Reverse Mapping Rules — CanonicalProduct → Platform Format

## The Reverse Mapping Contract

Every platform that acts as a **target** must implement a reverse mapping:
`CanonicalProduct → PlatformSpecificDraft`

This is the counterpart to `toCanonical()`. It is called by `TargetConnector.load()` to convert a `CanonicalProduct` into the format the target platform's API expects.

---

## Where Reverse Logic Lives

```
packages/mapping/src/rules-engine/
  ├── commercetools.rules.ts        ← toCanonical (CT → Canonical)
  ├── ct-reverse.rules.ts           ← fromCanonical (Canonical → CT ProductDraft)
  ├── shopify.rules.ts              ← toCanonical (Shopify → Canonical)
  ├── shopify-reverse.rules.ts      ← fromCanonical (Canonical → Shopify ProductInput)
  └── scrape.rules.ts               ← toCanonical only (scrape is source-only)
```

`ProductMapper.fromCanonical(canonical)` delegates to the correct reverse rules file based on `this.platform`.

---

## Mandatory Rules for Reverse Mapping

### 1. Money: Canonical cents → Platform format

Canonical stores money as integer cents. Each platform has its own money format:

```typescript
// CT: centPrecision object
{ type: 'centPrecision', currencyCode: 'USD', centAmount: 1999, fractionDigits: 2 }

// Shopify: decimal string in major units
'19.99'   // NOT 1999

// BigCommerce: float (unavoidable — their API uses floats)
19.99
```

NEVER pass `centAmount` directly to Shopify or BigCommerce — always divide by `10^fractionDigits`.

### 2. Locale fields: Always extract with fallback

```typescript
// CORRECT — safe extraction with fallback
const title = canonical.name['en'] ?? canonical.name['en-GB'] ?? Object.values(canonical.name)[0];

// WRONG — hard-coded locale assumption
const title = canonical.name['en'];  // Fails if only 'de' exists
```

Always provide a fallback chain: preferred locale → any available locale → empty string.

### 3. Key: Pass through as-is

The `canonical.key` is the idempotency key. It must be passed as-is to the target platform (as `key` in CT, as `handle` or a metafield in Shopify). Never regenerate or transform it.

### 4. Categories: Map by key, not ID

```typescript
// CT — categories referenced by key in drafts
categories: canonical.categoryKeys.map(key => ({ typeId: 'category' as const, key }))

// Shopify — categories become tags
tags: canonical.categoryKeys.join(', ')
```

Target projects must have matching category keys created first (PLATFORM_CLONE schema phase).

### 5. Product type fallback (CT-specific)

```typescript
productType: {
    typeId: 'product-type' as const,
    key: (canonical.customAttributes?.productType as string) ?? 'default-product-type',
}
```

The target CT project MUST have a product type with key `'default-product-type'` unless overridden via `customAttributes.productType`.

### 6. Upsert — never blindly create

The reverse mapping produces a **draft** (create payload). The connector is responsible for the upsert logic:

```typescript
// Pattern: try GET by key → 404 = create, 200 = update
try {
    const existing = await client.products().withKey({ key }).get().execute();
    await client.products().withKey({ key }).post({ body: { version: existing.body.version, actions } }).execute();
} catch (err: any) {
    if (err.statusCode === 404) {
        await client.products().post({ body: draft }).execute();
    } else {
        throw err; // Re-throw — non-404 errors are TransientError or FatalError
    }
}
```

### 7. Per-item error isolation

Every item in a batch is wrapped in its own `try/catch`. One item's failure must NOT abort the rest:

```typescript
async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
    return Promise.all(batch.map(async item => {
        try {
            // ... upsert logic
            return { key: item.key, success: true, targetId };
        } catch (error: any) {
            return { key: item.key, success: false, error: error.message };
        }
    }));
}
```

---

## Checklist for Adding a Reverse Mapping

- [ ] Created `packages/mapping/src/rules-engine/{platform}-reverse.rules.ts`
- [ ] `ProductMapper.fromCanonical()` switch case added for the platform
- [ ] Money converted correctly (cents → platform format)
- [ ] Locale fields extracted with fallback chain
- [ ] `canonical.key` passed through as idempotency key
- [ ] Categories mapped by key (not ID)
- [ ] Unit tests in `packages/mapping/src/__tests__/reverse-mapping.spec.ts`
- [ ] Target connector `load()` calls `this.mapper.fromCanonical(item)`
- [ ] Load uses upsert pattern — not blind create
- [ ] Per-item errors return `LoadResult { success: false }` — do not throw from `load()`
