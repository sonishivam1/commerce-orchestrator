import { CanonicalProduct, CanonicalVariant, DEFAULT_CURRENCY } from '@cdo/shared';
import { normalizeLocaleString, normalizeMoney } from '../normalizers';

/**
 * Transforms Shopify Admin GET /admin/api/2024-01/products.json product representation
 * to our CanonicalProduct.
 */
export const mapShopifyProduct = (shopifyProduct: any): CanonicalProduct => {
    // Map variants using our standard format
    const canonicalVariants = (shopifyProduct.variants || []).map((v: any): CanonicalVariant => {
        const rawAttrs = {
            option1: v.option1,
            option2: v.option2,
            option3: v.option3,
            weight: v.weight,
            weightUnit: v.weight_unit,
            barcode: v.barcode
        };
        const attributes: Record<string, string | number | boolean> = {};
        for (const [k, val] of Object.entries(rawAttrs)) {
            if (val !== undefined && val !== null) {
                attributes[k] = val as string | number | boolean;
            }
        }

        return {
            sku: v.sku || String(v.id),
            prices: v.price ? [normalizeMoney(v.price, DEFAULT_CURRENCY)] : [], // Shopify doesn't provide currency in strict float, implies shop currency
            attributes,
            stockQuantity: v.inventory_quantity ?? undefined,
            images: shopifyProduct.images
                ? shopifyProduct.images
                    .filter((img: any) => img.variant_ids && img.variant_ids.includes(v.id))
                    .map((img: any) => img.src)
                : []
        };
    });

    const masterVariant = canonicalVariants.length > 0 ? canonicalVariants[0] : {
        sku: String(shopifyProduct.id),
        prices: [],
        attributes: {},
        images: []
    };

    const variants = canonicalVariants.length > 1 ? canonicalVariants.slice(1) : [];

    const categoryKeys = shopifyProduct.tags 
        ? shopifyProduct.tags.split(',').map((t: string) => t.trim()) 
        : [];
        
    if (shopifyProduct.product_type) {
        categoryKeys.push(shopifyProduct.product_type);
    }

    return {
        _version: 'v1',
        key: `shopify-${shopifyProduct.id}`,
        name: normalizeLocaleString(shopifyProduct.title),
        description: normalizeLocaleString(shopifyProduct.body_html || shopifyProduct.body),
        slug: normalizeLocaleString(shopifyProduct.handle),
        categoryKeys: Array.from(new Set(categoryKeys)) as string[], // dedup
        isPublished: shopifyProduct.status === 'active',
        masterVariant,
        variants,
        customAttributes: {
            vendor: shopifyProduct.vendor,
            tags: shopifyProduct.tags,
            createdAt: shopifyProduct.created_at,
            updatedAt: shopifyProduct.updated_at
        }
    };
};
