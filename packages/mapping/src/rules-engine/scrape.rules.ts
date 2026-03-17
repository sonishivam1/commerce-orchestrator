import { CanonicalProduct, DEFAULT_CURRENCY } from '@cdo/shared';
import { normalizeLocaleString, normalizeMoney } from '../normalizers';

export interface ScrapedProductInput {
    url: string;
    title?: string;
    description?: string;
    price?: number | string;
    currency?: string;
    sku?: string;
    slug?: string;
    images?: string[];
    breadcrumbs?: string[];
    inStock?: boolean;
    extractedAttributes?: Record<string, string>;
}

/**
 * Transforms normalized raw HTML JSON from a Scraper 
 * into our CanonicalProduct.
 */
export const mapScrapedProduct = (scraped: ScrapedProductInput): CanonicalProduct => {
    
    // Very naive fallback key generation
    const key = scraped.sku || Buffer.from(scraped.url).toString('base64url').substring(0, 50);

    const priceObj = scraped.price 
        ? normalizeMoney(scraped.price, scraped.currency || DEFAULT_CURRENCY)
        : undefined;

    return {
        _version: 'v1',
        key,
        name: normalizeLocaleString(scraped.title || 'Unknown Product'),
        description: normalizeLocaleString(scraped.description || 'No description'),
        slug: normalizeLocaleString(scraped.slug || scraped.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || key),
        categoryKeys: scraped.breadcrumbs || [],
        isPublished: true, // We scraped it, so it's live
        masterVariant: {
            sku: scraped.sku || 'unknown',
            prices: priceObj ? [priceObj] : [],
            attributes: scraped.extractedAttributes || {},
            images: scraped.images || [],
            stockQuantity: scraped.inStock !== false ? 999 : 0
        },
        variants: [], // Scraped data is often just flat
        customAttributes: {
            sourceUrl: scraped.url
        }
    };
};
