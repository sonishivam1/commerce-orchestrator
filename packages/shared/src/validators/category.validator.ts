/**
 * @file category.validator.ts
 * @package @cdo/shared
 *
 * Zod schema for CanonicalCategory.
 * Categories form a tree — parentKey links to another category's key.
 * orderHint controls display ordering in the target platform.
 *
 * NOTE: Uses Zod v4 API.
 * - z.record() requires two args: z.record(keySchema, valueSchema)
 * - .refine() second arg is a plain string (not an object)
 */

import { z } from 'zod';
import { CANONICAL_VERSION } from '../constants';

/** Shared URL-safe key rule — reused across all canonical validators */
const canonicalKeySchema = z
    .string()
    .min(1)
    .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Key must be URL-safe: only letters, numbers, hyphens, underscores',
    );

/**
 * Locale map with minimum one entry.
 * In Zod v4, z.record() takes explicit key + value schemas.
 */
const LocalizedStringSchema = z
    .record(z.string(), z.string().min(1, 'Locale value cannot be empty'))
    .refine(
        (obj) => Object.keys(obj).length > 0,
        'Must have at least one locale entry',
    );

/**
 * Validates a CanonicalCategory object.
 * orderHint is a decimal string (e.g. "0.5") used by commercetools for sorting.
 */
export const CanonicalCategorySchema = z.object({
    _version: z.literal(CANONICAL_VERSION),
    id: z.string().optional(),
    key: canonicalKeySchema,
    name: LocalizedStringSchema,
    slug: LocalizedStringSchema,
    parentKey: canonicalKeySchema.optional(),
    orderHint: z
        .string()
        .regex(/^\d+(\.\d+)?$/, 'orderHint must be a decimal string, e.g. "0.5"')
        .optional(),
});

export type CanonicalCategoryInput = z.input<typeof CanonicalCategorySchema>;
export type CanonicalCategoryOutput = z.output<typeof CanonicalCategorySchema>;

/**
 * Safe-parse wrapper — never throws, always returns result with success flag.
 * @param raw - Raw category object from mapper
 */
export function validateCanonicalCategory(raw: unknown) {
    return CanonicalCategorySchema.safeParse(raw);
}
