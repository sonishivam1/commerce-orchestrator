/**
 * @file customer.validator.ts
 * @package @cdo/shared
 *
 * Zod schemas for CanonicalCustomer and CanonicalAddress.
 * Covers both B2C and B2B customers (companyName makes it B2B context).
 * Country codes are ISO 3166-1 alpha-2 (2 letters, uppercase).
 */

import { z } from 'zod';
import { CANONICAL_VERSION } from '../constants';

/**
 * Validates a postal address.
 * Country must be a 2-letter ISO 3166-1 alpha-2 code (e.g. 'GB', 'US', 'DE').
 */
export const CanonicalAddressSchema = z.object({
    key: z.string().optional(),
    streetName: z.string().min(1, 'Street name cannot be empty'),
    city: z.string().min(1, 'City cannot be empty'),
    postalCode: z.string().min(1, 'Postal code cannot be empty'),
    country: z
        .string()
        .length(2, 'Country must be a 2-letter ISO 3166-1 alpha-2 code (e.g. GB, US)')
        .toUpperCase(),
    isDefault: z.boolean().default(false),
});

/**
 * Validates a CanonicalCustomer.
 * Email must be a valid email format — used as the customer's unique identifier.
 * At least firstName OR companyName must be present to be a valid entity.
 */
export const CanonicalCustomerSchema = z
    .object({
        _version: z.literal(CANONICAL_VERSION),
        id: z.string().optional(),
        key: z
            .string()
            .min(1)
            .regex(/^[a-zA-Z0-9_-]+$/, 'Customer key must be URL-safe'),
        email: z.string().email('Customer email must be a valid email address'),
        firstName: z.string().min(1, 'First name cannot be empty'),
        lastName: z.string().min(1, 'Last name cannot be empty'),
        companyName: z.string().optional(), // B2B field
        addresses: z.array(CanonicalAddressSchema).default([]),
    });

export type CanonicalAddressInput = z.input<typeof CanonicalAddressSchema>;
export type CanonicalCustomerInput = z.input<typeof CanonicalCustomerSchema>;
export type CanonicalCustomerOutput = z.output<typeof CanonicalCustomerSchema>;

/**
 * Safe-parse wrapper for CanonicalCustomer.
 * @param raw - Raw customer object from mapper
 */
export function validateCanonicalCustomer(raw: unknown) {
    return CanonicalCustomerSchema.safeParse(raw);
}
