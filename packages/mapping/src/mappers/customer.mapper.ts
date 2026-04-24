import { ErrorType, CanonicalCustomer, validateCanonicalCustomer } from '@cdo/shared';
import { SourcePlatform, EntityMapper } from './product.mapper';

export const mapShopifyCustomer = (raw: any): CanonicalCustomer => {
    return {
        _version: 'v1',
        key: `shopify-${raw.id}`,
        email: raw.email,
        firstName: raw.first_name || '',
        lastName: raw.last_name || '',
        companyName: undefined, // Usually missing in raw REST customer, sometimes stored in tags or metafields
        addresses: raw.addresses?.map((addr: any) => ({
            streetName: addr.address1 || '',
            city: addr.city || '',
            postalCode: addr.zip || '',
            country: addr.country_code || '',
            isDefault: addr.default || false
        }))
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
        }))
    };
};

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

    fromCanonical(canonical: CanonicalCustomer): any {
        throw new Error('CustomerMapper.fromCanonical not implemented');
    }
}
