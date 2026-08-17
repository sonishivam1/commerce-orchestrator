import { ErrorType, CanonicalCategory, validateCanonicalCategory } from '@cdo/shared';
import { SourcePlatform, EntityMapper } from './product.mapper';
import { normalizeLocaleString } from '../normalizers';

export const mapShopifyCategory = (raw: any): CanonicalCategory => {
    return {
        _version: 'v1',
        key: `shopify-${raw.id}`,
        name: normalizeLocaleString(raw.title || raw.node?.title),
        slug: normalizeLocaleString(raw.handle || raw.node?.handle),
    };
};

export const mapCommercetoolsCategory = (raw: any): CanonicalCategory => {
    return {
        _version: 'v1',
        key: raw.key || raw.id,
        name: normalizeLocaleString(raw.name),
        slug: normalizeLocaleString(raw.slug),
        parentKey: raw.parent?.id || undefined,
        orderHint: raw.orderHint,
    };
};

// ── Reverse mappings ────────────────────────────────────────────────────────

/**
 * Converts a CanonicalCategory to a Commercetools CategoryDraft.
 * See: https://docs.commercetools.com/api/projects/categories#categorydraft
 */
export const canonicalToCtCategoryDraft = (canonical: CanonicalCategory): Record<string, unknown> => {
    const draft: Record<string, unknown> = {
        key: canonical.key,
        name: canonical.name,
        slug: canonical.slug,
    };

    if (canonical.parentKey) {
        draft.parent = { typeId: 'category', key: canonical.parentKey };
    }

    if (canonical.orderHint) {
        draft.orderHint = canonical.orderHint;
    }

    return draft;
};

/**
 * Converts a CanonicalCategory to a Shopify CustomCollectionInput.
 * Note: Shopify collections don't support nested parent/child hierarchies
 * in the same way as CT — parentKey is stored as a metafield if present.
 */
export const canonicalToShopifyCategoryInput = (canonical: CanonicalCategory): Record<string, unknown> => {
    // Extract best available locale for title/handle
    const title = canonical.name['en'] ?? canonical.name['en-GB'] ?? Object.values(canonical.name)[0] ?? '';
    const handle = canonical.slug['en'] ?? canonical.slug['en-GB'] ?? Object.values(canonical.slug)[0] ?? canonical.key;

    return {
        title,
        handle,
    };
};

// ── Mapper class ────────────────────────────────────────────────────────────

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

    fromCanonical(canonical: CanonicalCategory): Record<string, unknown> {
        switch (this.platform) {
            case SourcePlatform.COMMERCETOOLS:
                return canonicalToCtCategoryDraft(canonical);
            case SourcePlatform.SHOPIFY:
                return canonicalToShopifyCategoryInput(canonical);
            default: {
                const err = new Error(`fromCanonical not supported for platform: ${this.platform}`);
                (err as any).type = ErrorType.FATAL;
                throw err;
            }
        }
    }
}
