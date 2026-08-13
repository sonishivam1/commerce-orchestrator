import { CanonicalProduct, CanonicalVariant, Money, DEFAULT_CURRENCY } from '@cdo/shared';
import { normalizeLocaleString } from '../normalizers';

// ─── Reverse Mapping: Canonical → Commercetools ───────────────────────────────

/**
 * Converts a CanonicalVariant to a Commercetools ProductVariantDraft-shaped object.
 * Used when creating or updating products in a CT project.
 */
const buildCtVariantDraft = (variant: CanonicalVariant): Record<string, unknown> => {
    const prices = variant.prices.map(p => ({
        value: {
            type: 'centPrecision',
            centAmount: p.centAmount,
            currencyCode: p.currencyCode,
            fractionDigits: p.fractionDigits,
        },
    }));

    const attributes = Object.entries(variant.attributes).map(([name, value]) => ({ name, value }));

    const images = variant.images.map((url, idx) => ({
        url,
        label: `image-${idx + 1}`,
        dimensions: { w: 0, h: 0 },
    }));

    return { sku: variant.sku, prices, attributes, images };
};

/**
 * Converts a CanonicalProduct to a Commercetools ProductDraft-shaped object.
 *
 * @param canonical  - The normalised product.
 * @param productTypeId - Required CT ProductType ID.  Supply `canonical.customAttributes.productType`
 *                        when available, otherwise fall back to a project-level default.
 */
export const canonicalToCtProductDraft = (
    canonical: CanonicalProduct,
    productTypeId: string,
): Record<string, unknown> => {
    const hasDescription = Object.values(canonical.description).some(v => v.trim() !== '');

    return {
        productType: { typeId: 'product-type', id: productTypeId },
        key: canonical.key,
        name: canonical.name,
        slug: canonical.slug,
        ...(hasDescription ? { description: canonical.description } : {}),
        masterVariant: buildCtVariantDraft(canonical.masterVariant),
        variants: canonical.variants.map(v => buildCtVariantDraft(v)),
        publish: canonical.isPublished,
    };
};

/**
 * Computes the minimal set of CT ProductUpdateActions needed to bring an
 * existing CT product in line with a CanonicalProduct.
 *
 * @param canonical  - Desired state.
 * @param existing   - Current CT product representation (full API response body).
 */
export const buildCtUpdateActions = (
    canonical: CanonicalProduct,
    existing: Record<string, unknown>,
): Array<Record<string, unknown>> => {
    const actions: Array<Record<string, unknown>> = [];

    // Always push name + slug so that staged changes stay in sync.
    actions.push({ action: 'changeName', name: canonical.name, staged: false });
    actions.push({ action: 'changeSlug', slug: canonical.slug, staged: false });

    const hasDescription = Object.values(canonical.description).some(v => v.trim() !== '');
    if (hasDescription) {
        actions.push({ action: 'setDescription', description: canonical.description, staged: false });
    }

    // Master variant SKU — only update if changed to avoid unnecessary revision bumps.
    const currentData = existing.masterData as Record<string, unknown> | undefined;
    const current = (currentData?.current ?? currentData?.staged ?? {}) as Record<string, unknown>;
    const masterVariant = current.masterVariant as Record<string, unknown> | undefined;
    if (masterVariant && masterVariant.sku !== canonical.masterVariant.sku) {
        actions.push({
            action: 'setSku',
            variantId: masterVariant.id,
            sku: canonical.masterVariant.sku,
            staged: false,
        });
    }

    // Publish / unpublish based on canonical state.
    const isPublished = (existing.masterData as any)?.published ?? false;
    if (canonical.isPublished && !isPublished) {
        actions.push({ action: 'publish' });
    } else if (!canonical.isPublished && isPublished) {
        actions.push({ action: 'unpublish' });
    }

    return actions;
};

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
