/**
 * @file order.validator.ts
 * @package @cdo/shared
 *
 * Zod schemas for CanonicalOrder and CanonicalLineItem.
 * Orders reference customers and products via their keys (not IDs)
 * so they remain portable across platforms.
 */

import { z } from 'zod';
import { MoneySchema } from './money.validator';
import { CANONICAL_VERSION } from '../constants';

/** Allowed order status values — maps to standard commerce lifecycle states */
const OrderStatusSchema = z.enum(['Open', 'Confirmed', 'Complete', 'Cancelled']);

/**
 * Validates a single line item within an order.
 * References products and variants by their canonical keys — not platform-specific IDs.
 */
export const CanonicalLineItemSchema = z.object({
    productKey: z
        .string()
        .min(1, 'productKey cannot be empty')
        .regex(/^[a-zA-Z0-9_-]+$/, 'productKey must be URL-safe'),
    variantSku: z.string().min(1, 'variantSku cannot be empty'),
    quantity: z.number().int().positive('Quantity must be a positive integer'),
    unitPrice: MoneySchema,
});

/**
 * Validates a CanonicalOrder.
 * An order must have:
 * - At least one line item
 * - A valid total price (integer cents)
 * - A currency code matching the line items (not enforced here, but documented)
 */
export const CanonicalOrderSchema = z.object({
    _version: z.literal(CANONICAL_VERSION),
    id: z.string().optional(),
    key: z
        .string()
        .min(1)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Order key must be URL-safe'),
    customerKey: z
        .string()
        .min(1, 'customerKey cannot be empty')
        .regex(/^[a-zA-Z0-9_-]+$/, 'customerKey must be URL-safe'),
    lineItems: z.array(CanonicalLineItemSchema).min(1, 'Order must contain at least one line item'),
    totalPrice: MoneySchema,
    currency: z
        .string()
        .length(3, 'Currency must be a 3-letter ISO 4217 code')
        .toUpperCase(),
    status: OrderStatusSchema,
});

export type CanonicalLineItemInput = z.input<typeof CanonicalLineItemSchema>;
export type CanonicalOrderInput = z.input<typeof CanonicalOrderSchema>;
export type CanonicalOrderOutput = z.output<typeof CanonicalOrderSchema>;

/**
 * Safe-parse wrapper for CanonicalOrder.
 * @param raw - Raw order object from mapper
 */
export function validateCanonicalOrder(raw: unknown) {
    return CanonicalOrderSchema.safeParse(raw);
}
