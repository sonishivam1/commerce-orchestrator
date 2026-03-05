/**
 * @file money.validator.ts
 * @package @cdo/shared
 *
 * Zod schema for the Money type.
 * Money is always stored as integer cent amounts — never floats.
 * e.g. £12.99 → { centAmount: 1299, currencyCode: 'GBP', fractionDigits: 2 }
 */

import { z } from 'zod';

/**
 * Validates that a currency code is a 3-letter ISO 4217 string.
 * e.g. 'USD', 'GBP', 'EUR'
 */
const currencyCodeSchema = z
    .string()
    .length(3, 'Currency code must be exactly 3 characters (ISO 4217)')
    .toUpperCase();

/**
 * Validates the Money object.
 * centAmount must be a non-negative integer (no decimals, no negative prices).
 * fractionDigits defines how many decimal places the currency uses (2 for most, 0 for JPY).
 */
export const MoneySchema = z.object({
    centAmount: z
        .number()
        .int('centAmount must be an integer — multiply by 100 before storing')
        .nonnegative('centAmount cannot be negative'),
    currencyCode: currencyCodeSchema,
    fractionDigits: z
        .number()
        .int()
        .min(0)
        .max(6)
        .default(2),
});

export type MoneyInput = z.input<typeof MoneySchema>;
export type MoneyOutput = z.output<typeof MoneySchema>;
