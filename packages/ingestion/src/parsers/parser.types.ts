/**
 * @file parser.types.ts
 * @package @cdo/ingestion
 *
 * Shared type contracts between the scraper and the mapping/rules layer.
 * These types describe the raw extracted data BEFORE it is mapped
 * to the CanonicalProduct format.
 */

/**
 * A single raw price extracted from the DOM.
 * currency is optional — the mapping layer falls back to DEFAULT_CURRENCY.
 */
export interface RawPrice {
    amount: string; // raw string e.g. "29.99", "1,299.00"
    currency?: string; // e.g. "USD", optional
}

/**
 * A single raw variant extracted from the DOM.
 */
export interface RawVariant {
    sku?: string;
    price?: RawPrice;
    attributes?: Record<string, string>; // e.g. { size: "L", color: "Red" }
    inventoryQuantity?: number;
}

/**
 * Raw product data extracted from a page by the PageExtractor.
 * This is the intermediate format before rule-based normalisation.
 */
export interface RawScrapedProduct {
    /** Full URL of the product page */
    sourceUrl: string;

    /** Raw product title from the DOM */
    title?: string;

    /** Product description — may be HTML */
    description?: string;

    /** Primary price */
    price?: RawPrice;

    /** Product images found on the page */
    imageUrls?: string[];

    /** Variants extracted from option selectors / schema.org */
    variants?: RawVariant[];

    /** Arbitrary extra fields pulled from structured data (schema.org, meta tags) */
    meta?: Record<string, string>;
}

/**
 * Status of a single scrape attempt.
 */
export interface ScrapeResult {
    url: string;
    success: boolean;
    data?: RawScrapedProduct;
    error?: string;
}
