/**
 * @file product.parser.ts
 * @package @cdo/ingestion
 *
 * Converts a RawScrapedProduct (from PageExtractor) into a ScrapedProductInput
 * (the format accepted by @cdo/mapping's mapScrapedProduct rule).
 *
 * This is the bridge between the ingestion layer and the mapping layer.
 * It owns only format-conversion logic — no business rules, no validation.
 * Validation is delegated to @cdo/mapping's Zod schema.
 */

import type { RawScrapedProduct } from './parser.types';

/**
 * ScrapedProductInput — mirrors the interface from @cdo/mapping/scrape.rules.ts.
 * Redefined here to avoid a circular package dependency
 * (ingestion must not import from mapping).
 *
 * These two interfaces must stay in sync.
 */
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
 * Converts a raw DOM extraction result into a ScrapedProductInput.
 *
 * Rules:
 * - Price amounts with commas are normalized (1,299 → 1299)
 * - Slug is derived from the title if not provided
 * - Images are de-duplicated and capped at a reasonable limit
 */
export function parseRawProduct(raw: RawScrapedProduct): ScrapedProductInput {
    // Normalize price: strip currency symbols, commas → parse as float
    let price: number | undefined;
    let currency: string | undefined;

    if (raw.price?.amount) {
        const normalized = raw.price.amount
            .replace(/,/g, '') // "1,299" → "1299"
            .replace(/[^0-9.]/g, ''); // strip currency symbols
        const parsed = parseFloat(normalized);
        price = isNaN(parsed) ? undefined : parsed;
        currency = raw.price.currency ?? undefined;
    }

    // Derive slug from title
    const slug = raw.title
        ? raw.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : undefined;

    // Collapse all variant attributes into a flat map for the master variant
    const extractedAttributes: Record<string, string> = {};
    for (const variant of raw.variants ?? []) {
        for (const [k, v] of Object.entries(variant.attributes ?? {})) {
            // Only record attribute if not already set (master variant takes first occurrence)
            if (!(k in extractedAttributes)) {
                extractedAttributes[k] = v;
            }
        }
    }

    // Source meta tags
    const siteName = raw.meta?.['og:site_name'];
    if (siteName) extractedAttributes['site_name'] = siteName;

    return {
        url: raw.sourceUrl,
        title: raw.title,
        description: stripHtmlTags(raw.description),
        price,
        currency,
        slug,
        images: deduplicateUrls(raw.imageUrls ?? []).slice(0, 20), // cap at 20 images
        breadcrumbs: raw.meta ? [] : [],
        inStock: true, // If we scraped it, assume in stock; can be refined later
        extractedAttributes: Object.keys(extractedAttributes).length > 0 ? extractedAttributes : undefined,
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtmlTags(html?: string): string | undefined {
    if (!html) return undefined;
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function deduplicateUrls(urls: string[]): string[] {
    const seen = new Set<string>();
    return urls.filter((url) => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
}
