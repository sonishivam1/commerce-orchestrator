// Canonical Models — versioned shared contract for the entire platform
// All connectors, mappers, and the core engine operate on these types only.
// Version: v1

export interface LocalizedString {
    [locale: string]: string; // e.g. { "en-GB": "Product Name" }
}

export interface Money {
    centAmount: number;
    currencyCode: string; // ISO 4217
    fractionDigits: number;
}

export interface CanonicalVariant {
    sku: string;
    prices: Money[];
    attributes: Record<string, string | number | boolean>;
    images: string[];
    stockQuantity?: number;
}

export interface CanonicalProduct {
    _version: 'v1';
    id?: string;
    key: string; // Unique idempotency key
    name: LocalizedString;
    description: LocalizedString;
    slug: LocalizedString;
    categoryKeys: string[];
    masterVariant: CanonicalVariant;
    variants: CanonicalVariant[];
    isPublished: boolean;
    customAttributes?: Record<string, unknown>;
}

export interface CanonicalCategory {
    _version: 'v1';
    id?: string;
    key: string;
    name: LocalizedString;
    slug: LocalizedString;
    parentKey?: string;
    orderHint?: string;
}

export interface CanonicalCustomer {
    _version: 'v1';
    id?: string;
    key: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName?: string; // B2B
    addresses?: CanonicalAddress[];
}

export interface CanonicalAddress {
    key?: string;
    streetName: string;
    city: string;
    postalCode: string;
    country: string; // ISO 3166-1 alpha-2
    isDefault?: boolean;
}

export interface CanonicalOrder {
    _version: 'v1';
    id?: string;
    key: string;
    customerKey: string;
    lineItems: CanonicalLineItem[];
    totalPrice: Money;
    currency: string;
    status: 'Open' | 'Confirmed' | 'Complete' | 'Cancelled';
}

export interface CanonicalLineItem {
    productKey: string;
    variantSku: string;
    quantity: number;
    unitPrice: Money;
}

export type CanonicalEntity =
    | CanonicalProduct
    | CanonicalCategory
    | CanonicalCustomer
    | CanonicalOrder;
