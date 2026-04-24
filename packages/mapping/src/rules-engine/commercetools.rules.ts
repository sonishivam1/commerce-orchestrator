import { CanonicalProduct, CanonicalVariant, Money, DEFAULT_CURRENCY } from '@cdo/shared';
import { normalizeLocaleString } from '../normalizers';

/**
 * Transforms Commercetools ProductProjection representation
 * to our CanonicalProduct.
 */
export const mapCommercetoolsProduct = (ctProduct: any): CanonicalProduct => {
    
    const mapVariant = (v: any): CanonicalVariant => {
        let prices: Money[] = [];
        if (v.prices && Array.isArray(v.prices)) {
            prices = v.prices.map((p: any) => {
                const val = p.value || {};
                return {
                    centAmount: val.centAmount ?? 0,
                    currencyCode: val.currencyCode ?? DEFAULT_CURRENCY,
                    fractionDigits: val.fractionDigits ?? 2
                };
            });
        }

        const attributes: Record<string, string | number | boolean> = {};
        if (v.attributes && Array.isArray(v.attributes)) {
            v.attributes.forEach((attr: any) => {
                // Simplification for key-value pair attributes
                attributes[attr.name] = attr.value;
            });
        }

        const images = v.images && Array.isArray(v.images) 
            ? v.images.map((img: any) => img.url) 
            : [];

        // Availability structure can differ, typically inside availability object
        let stockQuantity: number | undefined;
        if (v.availability && v.availability.availableQuantity !== undefined) {
            stockQuantity = v.availability.availableQuantity;
        }

        return {
            sku: v.sku || String(v.id || 'unknown'),
            prices,
            attributes,
            images,
            stockQuantity
        };
    };

    const masterVariant = ctProduct.masterVariant 
        ? mapVariant(ctProduct.masterVariant)
        : { sku: 'unknown', prices: [], attributes: {}, images: [] };

    const variants = ctProduct.variants && Array.isArray(ctProduct.variants)
        ? ctProduct.variants.map(mapVariant)
        : [];

    const categoryKeys = ctProduct.categories && Array.isArray(ctProduct.categories)
        ? ctProduct.categories.map((c: any) => c.id) // Fallback to ID; CT often returns minified references
        : [];

    return {
        _version: 'v1',
        key: ctProduct.key || ctProduct.id,
        name: normalizeLocaleString(ctProduct.name),
        description: normalizeLocaleString(ctProduct.description),
        slug: normalizeLocaleString(ctProduct.slug),
        categoryKeys: Array.from(new Set(categoryKeys)) as string[],
        isPublished: ctProduct.published || ctProduct.hasStagedChanges !== true, // naive approximation 
        masterVariant,
        variants,
        customAttributes: {
            productType: ctProduct.productType?.id,
            metaTitle: normalizeLocaleString(ctProduct.metaTitle)
        }
    };
};
