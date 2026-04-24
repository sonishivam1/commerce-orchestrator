/**
 * @file product.validator.ts
 * @package @cdo/shared
 *
 * Zod runtime schema for CanonicalProduct.
 * Every mapper MUST run data through this validator before the Core Engine
 * attempts to load it. A ZodError here triggers a ValidationError → DLQ.
 *
 * NOTE: Uses Zod v4 API.
 * - z.record() requires two args: z.record(keySchema, valueSchema)
 * - z.array().min() is removed; use .refine() for array length checks
 * - .refine(fn, message) second arg is optional string
 */

import { z } from 'zod';
import { MoneySchema } from './money.validator';
import { CANONICAL_VERSION } from '../constants';

/**
 * Validates a LocalizedString map.
 * At minimum one locale must be present. Keys are locale codes (e.g. 'en', 'en-GB').
 * Values are non-empty strings.
 */
const LocalizedStringSchema = z
    .record(z.string(), z.string().min(1, 'Locale value cannot be empty'))
    .refine(
        (obj) => Object.keys(obj).length > 0,
        'LocalizedString must contain at least one locale entry',
    );

/**
 * Validates a product variant.
 * Each variant must have a non-empty SKU and at least one price.
 */
const CanonicalVariantSchema = z.object({
    sku: z.string().min(1, 'Variant SKU cannot be empty'),

    // z.array().min() removed in Zod v4 — use .refine() for length validation
    prices: z
        .array(MoneySchema)
        .refine((arr) => arr.length > 0, 'Variant must have at least one price'),

    // In Zod v4, z.record() requires explicit key + value schemas
    attributes: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .default({}),

    images: z.array(z.string().url('Image must be a valid URL')).default([]),
    stockQuantity: z.number().int().nonnegative().optional(),
});

/**
 * Full CanonicalProduct Zod schema.
 *
 * Key rules enforced here:
 * - `key` must be URL-safe (used as idempotency key in target platform APIs)
 * - `_version` must match the current CANONICAL_VERSION constant
 * - `name` and `description` must have at least one locale
 * - `masterVariant` is required; `variants` can be empty for simple products
 */
export const CanonicalProductSchema = z.object({
    _version: z.literal(CANONICAL_VERSION),
    id: z.string().optional(),
    key: z
        .string()
        .min(1, 'Product key cannot be empty')
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            'Product key must be URL-safe: only letters, numbers, hyphens, underscores',
        ),
    name: LocalizedStringSchema,
    description: LocalizedStringSchema,
    slug: LocalizedStringSchema,
    categoryKeys: z.array(z.string()).default([]),
    masterVariant: CanonicalVariantSchema,
    variants: z.array(CanonicalVariantSchema).default([]),
    isPublished: z.boolean().default(false),

    // z.record() in Zod v4 requires key + value schemas
    customAttributes: z.record(z.string(), z.unknown()).optional(),
});

export type CanonicalProductInput = z.input<typeof CanonicalProductSchema>;
export type CanonicalProductOutput = z.output<typeof CanonicalProductSchema>;

/**
 * Validates a raw object against the CanonicalProduct schema.
 * Returns a typed result — never throws.
 * Callers should check `result.success` before using `result.data`.
 *
 * @param raw - The raw object to validate (from mapper output)
 */
export function validateCanonicalProduct(raw: unknown) {
    return CanonicalProductSchema.safeParse(raw);
}
