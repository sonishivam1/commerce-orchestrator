import { ErrorType, CanonicalCustomer, validateCanonicalCustomer } from '@cdo/shared';
import { SourcePlatform, EntityMapper } from './product.mapper';

export const mapShopifyCustomer = (raw: any): CanonicalCustomer => {
    return {
        _version: 'v1',
        key: `shopify-${raw.id}`,
        email: raw.email,
        firstName: raw.firstName ?? raw.first_name ?? '',
        lastName: raw.lastName ?? raw.last_name ?? '',
        companyName: undefined,
        addresses: raw.addresses?.map((addr: any) => ({
            streetName: addr.address1 || addr.streetName || '',
            city: addr.city || '',
            postalCode: addr.zip || addr.postalCode || '',
            country: addr.country_code || addr.country || '',
            isDefault: addr.default || addr.isDefault || false,
        })) ?? (raw.defaultAddress ? [{
            streetName: raw.defaultAddress.address1 || '',
            city: raw.defaultAddress.city || '',
            postalCode: raw.defaultAddress.zip || '',
            country: raw.defaultAddress.country || '',
            isDefault: true,
        }] : undefined),
    };
};

export const mapCommercetoolsCustomer = (raw: any): CanonicalCustomer => {
    return {
        _version: 'v1',
        key: raw.key || raw.id,
        email: raw.email,
        firstName: raw.firstName || '',
        lastName: raw.lastName || '',
        companyName: raw.companyName,
        addresses: raw.addresses?.map((addr: any) => ({
            key: addr.key || addr.id,
            streetName: addr.streetName || '',
            city: addr.city || '',
            postalCode: addr.postalCode || '',
            country: addr.country || '', // ISO 3166
        })),
    };
};

// ── Reverse mappings ────────────────────────────────────────────────────────

/**
 * Converts a CanonicalCustomer to a Commercetools CustomerDraft.
 * See: https://docs.commercetools.com/api/projects/customers#customerdraft
 */
export const canonicalToCtCustomerDraft = (canonical: CanonicalCustomer): Record<string, unknown> => {
    const draft: Record<string, unknown> = {
        key: canonical.key,
        email: canonical.email,
        firstName: canonical.firstName,
        lastName: canonical.lastName,
    };

    if (canonical.companyName) {
        draft.companyName = canonical.companyName;
    }

    if (canonical.addresses?.length) {
        draft.addresses = canonical.addresses.map(addr => ({
            key: addr.key,
            streetName: addr.streetName,
            city: addr.city,
            postalCode: addr.postalCode,
            country: addr.country,
        }));
    }

    return draft;
};

/**
 * Converts a CanonicalCustomer to a Shopify CustomerInput.
 * See: https://shopify.dev/docs/api/admin-graphql/2024-01/input-objects/CustomerInput
 */
export const canonicalToShopifyCustomerInput = (canonical: CanonicalCustomer, existingId?: string): Record<string, unknown> => {
    const input: Record<string, unknown> = {
        firstName: canonical.firstName,
        lastName: canonical.lastName,
        email: canonical.email,
    };

    if (existingId) {
        input.id = existingId;
    }

    if (canonical.addresses?.length) {
        input.addresses = canonical.addresses.map(addr => ({
            address1: addr.streetName,
            city: addr.city,
            zip: addr.postalCode,
            country: addr.country,
        }));
    }

    return input;
};

// ── Mapper class ────────────────────────────────────────────────────────────

export class CustomerMapper implements EntityMapper<any, CanonicalCustomer> {

    constructor(private readonly platform: SourcePlatform) {}

    toCanonical(rawPayload: any): CanonicalCustomer {
        let unvalidatedCustomer: CanonicalCustomer;

        switch (this.platform) {
            case SourcePlatform.SHOPIFY:
                unvalidatedCustomer = mapShopifyCustomer(rawPayload);
                break;
            case SourcePlatform.COMMERCETOOLS:
                unvalidatedCustomer = mapCommercetoolsCustomer(rawPayload);
                break;
            default:
                const fatal = new Error(`Unsupported source platform: ${this.platform} for CustomerMapper`);
                (fatal as any).type = ErrorType.FATAL;
                throw fatal;
        }

        const validationResult = validateCanonicalCustomer(unvalidatedCustomer);

        if (!validationResult.success) {
            const errorObj = (validationResult as any).error;
            const errorMsg = errorObj.errors
                ? errorObj.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
                : errorObj.message;

            const error = new Error(`Validation failed for customer ${unvalidatedCustomer.key || 'unknown'}: ${errorMsg}`);
            (error as any).type = ErrorType.VALIDATION;
            throw error;
        }

        return validationResult.data as CanonicalCustomer;
    }

    fromCanonical(canonical: CanonicalCustomer, options?: Record<string, unknown>): Record<string, unknown> {
        switch (this.platform) {
            case SourcePlatform.COMMERCETOOLS:
                return canonicalToCtCustomerDraft(canonical);
            case SourcePlatform.SHOPIFY: {
                const existingId = options?.existingId as string | undefined;
                return canonicalToShopifyCustomerInput(canonical, existingId);
            }
            default: {
                const err = new Error(`fromCanonical not supported for platform: ${this.platform}`);
                (err as any).type = ErrorType.FATAL;
                throw err;
            }
        }
    }
}
