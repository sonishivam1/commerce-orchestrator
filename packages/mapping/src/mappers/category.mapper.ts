import { ErrorType, CanonicalCategory, validateCanonicalCategory } from '@cdo/shared';
import { SourcePlatform, EntityMapper } from './product.mapper';
import { normalizeLocaleString } from '../normalizers';

export const mapShopifyCategory = (raw: any): CanonicalCategory => {
    return {
        _version: 'v1',
        key: `shopify-${raw.id}`,
        name: normalizeLocaleString(raw.title || raw.node?.title),
        slug: normalizeLocaleString(raw.handle || raw.node?.handle)
    };
};

export const mapCommercetoolsCategory = (raw: any): CanonicalCategory => {
    return {
        _version: 'v1',
        key: raw.key || raw.id,
        name: normalizeLocaleString(raw.name),
        slug: normalizeLocaleString(raw.slug),
        parentKey: raw.parent?.id || undefined,
        orderHint: raw.orderHint
    };
};

export class CategoryMapper implements EntityMapper<any, CanonicalCategory> {
    
    constructor(private readonly platform: SourcePlatform) {}

    toCanonical(rawPayload: any): CanonicalCategory {
        let unvalidatedCategory: CanonicalCategory;

        switch (this.platform) {
            case SourcePlatform.SHOPIFY:
                unvalidatedCategory = mapShopifyCategory(rawPayload);
                break;
            case SourcePlatform.COMMERCETOOLS:
                unvalidatedCategory = mapCommercetoolsCategory(rawPayload);
                break;
            default: // Scrapers typically don't pull standalone categories in this engine
                const fatal = new Error(`Unsupported source platform: ${this.platform} for CategoryMapper`);
                (fatal as any).type = ErrorType.FATAL;
                throw fatal;
        }

        const validationResult = validateCanonicalCategory(unvalidatedCategory);
        
        if (!validationResult.success) {
            const errorObj = (validationResult as any).error;
            const errorMsg = errorObj.errors 
                ? errorObj.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
                : errorObj.message;

            const error = new Error(`Validation failed for category ${unvalidatedCategory.key || 'unknown'}: ${errorMsg}`);
            (error as any).type = ErrorType.VALIDATION;
            throw error;
        }

        return validationResult.data as CanonicalCategory;
    }

    fromCanonical(canonical: CanonicalCategory): any {
        throw new Error('CategoryMapper.fromCanonical not implemented');
    }
}
