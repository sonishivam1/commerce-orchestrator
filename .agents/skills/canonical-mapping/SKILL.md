---
name: canonical-mapping
description: Data mapping and normalization skill for Commerce Data Orchestrator. Encodes the Universal Canonical Contract, normalizer patterns (money, date, locale), rules engine, Zod validation, and ProductMapper lifecycle. Invoke when working with data transformation between platforms.
user-invocable: true
---

# Canonical Mapping Skill — Commerce Data Orchestrator

## The Universal Canonical Contract

All commerce data flows through a single canonical schema — the "universal language" between platforms.

```typescript
// packages/shared/src/models/canonical.types.ts
export interface CanonicalEntity {
    key: string;           // Platform-agnostic unique key
    version?: string;      // For optimistic concurrency
}

export interface CanonicalProduct extends CanonicalEntity {
    name: Record<string, string>;          // { "en": "T-Shirt", "de": "T-Shirt" }
    slug: Record<string, string>;          // { "en": "blue-t-shirt" }
    description: Record<string, string>;   // { "en": "A comfortable tee" }
    categories: string[];                  // Category keys (not IDs)
    variants: CanonicalVariant[];
    attributes: Record<string, unknown>;   // Platform-specific extras
}

export interface CanonicalVariant {
    sku: string;
    prices: CanonicalPrice[];
    images: CanonicalImage[];
    attributes: Record<string, unknown>;
}

export interface CanonicalPrice {
    amount: number;           // INTEGER — always cents, never float
    currencyCode: string;     // ISO 4217 (e.g., "USD", "EUR")
    country?: string;
}

export interface CanonicalImage {
    url: string;
    label?: string;
    dimensions?: { width: number; height: number };
}
```

**Critical Rules:**
- `Money.amount` is ALWAYS integer cents (`1999` = $19.99). Never float.
- Locale fields are `Record<string, string>` maps. Never bare strings.
- `key` is the join field between source and target. It must be deterministic and stable.

---

## Normalizer Patterns

### Money Normalizer
```typescript
// packages/mapping/src/normalizers/money.normalizer.ts
import { DEFAULT_CURRENCY } from '@cdo/shared';

export function normalizeMoney(input: unknown): { amount: number; currencyCode: string } {
    if (typeof input === 'number') {
        // Already cents
        return { amount: Math.round(input), currencyCode: DEFAULT_CURRENCY };
    }
    if (typeof input === 'string') {
        // "19.99" → 1999
        const float = parseFloat(input);
        if (isNaN(float)) throw new Error(`Invalid money value: ${input}`);
        return { amount: Math.round(float * 100), currencyCode: DEFAULT_CURRENCY };
    }
    if (typeof input === 'object' && input !== null) {
        const obj = input as any;
        return {
            amount: Math.round(Number(obj.centAmount ?? obj.amount ?? 0)),
            currencyCode: String(obj.currencyCode ?? obj.currency ?? DEFAULT_CURRENCY),
        };
    }
    throw new Error(`Cannot normalize money from type: ${typeof input}`);
}
```

### Date Normalizer
```typescript
// packages/mapping/src/normalizers/date.normalizer.ts
export function normalizeDate(input: unknown): string {
    if (input instanceof Date) return input.toISOString();
    if (typeof input === 'string') {
        const date = new Date(input);
        if (isNaN(date.getTime())) throw new Error(`Invalid date: ${input}`);
        return date.toISOString();
    }
    if (typeof input === 'number') return new Date(input).toISOString();
    throw new Error(`Cannot normalize date from type: ${typeof input}`);
}
```

### Locale Normalizer
```typescript
// packages/mapping/src/normalizers/locale.normalizer.ts
import { DEFAULT_LOCALE } from '@cdo/shared';

export function normalizeLocaleField(
    input: unknown
): Record<string, string> {
    if (typeof input === 'string') {
        return { [DEFAULT_LOCALE]: input };
    }
    if (typeof input === 'object' && input !== null) {
        return input as Record<string, string>;
    }
    return { [DEFAULT_LOCALE]: String(input ?? '') };
}
```

---

## ProductMapper — The Transformation Orchestrator

```typescript
// packages/mapping/src/product.mapper.ts
export class ProductMapper {
    constructor(private readonly platform: string) {}

    toCanonical(platformData: unknown): CanonicalProduct {
        // Step 1: Apply platform-specific rules
        const rules = RulesEngine.getRules(this.platform);
        const raw = rules.mapToCanonical(platformData);

        // Step 2: Normalize cross-cutting fields
        raw.name = normalizeLocaleField(raw.name);
        raw.description = normalizeLocaleField(raw.description);
        for (const variant of raw.variants ?? []) {
            for (const price of variant.prices ?? []) {
                Object.assign(price, normalizeMoney(price));
            }
        }

        // Step 3: Validate with Zod
        const result = CanonicalProductSchema.safeParse(raw);
        if (!result.success) {
            const error = new Error(`Validation failed: ${result.error.message}`);
            (error as any).type = ErrorType.VALIDATION;
            throw error;
        }

        return result.data;
    }

    fromCanonical(canonical: CanonicalProduct): unknown {
        const rules = RulesEngine.getRules(this.platform);
        return rules.mapFromCanonical(canonical);
    }
}
```

---

## Rules Engine — Platform-Specific Transformations

```typescript
// packages/mapping/src/rules-engine/shopify.rules.ts
export const shopifyRules: MappingRules = {
    mapToCanonical(shopifyProduct: ShopifyProduct): Partial<CanonicalProduct> {
        return {
            key: `shopify:${shopifyProduct.id}`,
            name: shopifyProduct.title,           // Will be locale-wrapped by normalizer
            slug: shopifyProduct.handle,
            description: shopifyProduct.body_html,
            variants: shopifyProduct.variants.map(v => ({
                sku: v.sku,
                prices: [{ amount: v.price, currencyCode: 'USD' }],
                images: [],
                attributes: { weight: v.weight, weightUnit: v.weight_unit },
            })),
            attributes: { vendor: shopifyProduct.vendor, tags: shopifyProduct.tags },
        };
    },

    mapFromCanonical(canonical: CanonicalProduct): Partial<ShopifyProduct> {
        return {
            title: canonical.name[DEFAULT_LOCALE] ?? Object.values(canonical.name)[0],
            handle: canonical.slug[DEFAULT_LOCALE],
            body_html: canonical.description[DEFAULT_LOCALE] ?? '',
            variants: canonical.variants.map(v => ({
                sku: v.sku,
                price: String(v.prices[0]?.amount / 100), // cents → dollars string
            })),
        };
    },
};
```

---

## Zod Validation Schemas

```typescript
// packages/shared/src/validators/canonical-product.validator.ts
import { z } from 'zod';

export const CanonicalPriceSchema = z.object({
    amount: z.number().int(),          // Must be integer (cents)
    currencyCode: z.string().length(3), // ISO 4217
    country: z.string().optional(),
});

export const CanonicalVariantSchema = z.object({
    sku: z.string().min(1),
    prices: z.array(CanonicalPriceSchema).min(1),
    images: z.array(z.object({ url: z.string().url() })),
    attributes: z.record(z.unknown()).default({}),
});

export const CanonicalProductSchema = z.object({
    key: z.string().min(1),
    name: z.record(z.string()),        // Locale map
    slug: z.record(z.string()),
    description: z.record(z.string()),
    categories: z.array(z.string()),
    variants: z.array(CanonicalVariantSchema).min(1),
    attributes: z.record(z.unknown()).default({}),
});
```

---

## Checklist for Mapping Changes

- [ ] Money values are integer cents — never float
- [ ] Locale fields wrapped as `Record<string, string>` — never bare strings
- [ ] `key` is deterministic and platform-prefixed (e.g., `shopify:123`)
- [ ] Zod schema validates the canonical output
- [ ] On validation failure, error has `type = ErrorType.VALIDATION`
- [ ] Both `toCanonical()` and `fromCanonical()` implemented
- [ ] Normalizers handle edge cases (null, undefined, wrong type)
- [ ] Tests cover valid input, edge cases, and invalid input (Zod rejection)
