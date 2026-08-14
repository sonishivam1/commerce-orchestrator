import { CanonicalProduct, CanonicalVariant, DEFAULT_CURRENCY } from '@cdo/shared';
import { normalizeLocaleString, normalizeMoney } from '../normalizers';

// ─── Reverse Mapping: Canonical → Shopify ─────────────────────────────────────

/**
 * Converts a CanonicalProduct to a Shopify Admin GraphQL ProductInput shape.
 * Pass the result directly to the `productCreate` or `productUpdate` mutation.
 *
 * @param canonical     - The normalised product.
 * @param existingId    - Shopify GID (e.g. "gid://shopify/Product/123"). When
 *                        supplied the input is suitable for `productUpdate`.
 * @param locationId    - Shopify Location GID needed for `inventoryQuantities`.
 *                        When absent inventory is left unchanged.
 */
export const canonicalToShopifyProductInput = (
    canonical: CanonicalProduct,
    existingId?: string,
    locationId?: string,
): Record<string, unknown> => {
    // Shopify is single-locale: take the first available locale value.
    const firstValue = (ls: Record<string, string>): string =>
        Object.values(ls)[0] ?? '';

    const allVariants = [canonical.masterVariant, ...canonical.variants];

    const variants = allVariants.map(v => {
        const price =
            v.prices.length > 0
                ? (v.prices[0].centAmount / Math.pow(10, v.prices[0].fractionDigits)).toFixed(
                      v.prices[0].fractionDigits,
                  )
                : '0.00';

        const variantInput: Record<string, unknown> = {
            sku: v.sku,
            price,
        };

        if (locationId && v.stockQuantity !== undefined) {
            variantInput.inventoryQuantities = [
                { availableQuantity: v.stockQuantity, locationId },
            ];
        }

        return variantInput;
    });

    const input: Record<string, unknown> = {
        title: firstValue(canonical.name) || canonical.key,
        descriptionHtml: firstValue(canonical.description),
        handle: firstValue(canonical.slug) || canonical.key,
        tags: canonical.categoryKeys,
        status: canonical.isPublished ? 'ACTIVE' : 'DRAFT',
        variants,
    };

    if (existingId) input.id = existingId;

    if (canonical.customAttributes?.vendor) {
        input.vendor = canonical.customAttributes.vendor as string;
    }

    return input;
};

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

/**
 * Reverses CanonicalProduct back into a Shopify Product.
 */
export const reverseMapShopifyProduct = (canonical: CanonicalProduct): any => {
    const mapVariant = (v: CanonicalVariant) => {
        const price = v.prices[0];
        
        return {
            sku: v.sku,
            price: price ? (price.centAmount / (10 ** price.fractionDigits)).toString() : undefined,
            inventory_quantity: v.stockQuantity,
            option1: v.attributes?.option1,
            option2: v.attributes?.option2,
            option3: v.attributes?.option3,
            weight: v.attributes?.weight,
            weight_unit: v.attributes?.weightUnit,
            barcode: v.attributes?.barcode
        };
    };

    const allVariants = [canonical.masterVariant, ...canonical.variants].map(mapVariant);

    // Extract default locale string
    const getLocaleString = (locales?: Record<string, string>) => locales ? Object.values(locales)[0] : '';

    return {
        product: {
            title: getLocaleString(canonical.name),
            body_html: getLocaleString(canonical.description),
            handle: getLocaleString(canonical.slug),
            status: canonical.isPublished ? 'active' : 'draft',
            tags: canonical.categoryKeys.join(', '),
            vendor: canonical.customAttributes?.vendor,
            product_type: canonical.customAttributes?.productType,
            variants: allVariants,
        }
    };
};
