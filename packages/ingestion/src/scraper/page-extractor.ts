/**
 * @file page-extractor.ts
 * @package @cdo/ingestion
 *
 * Extracts structured product data from a loaded Playwright Page.
 *
 * Extraction strategy (in priority order):
 * 1. schema.org JSON-LD Product structured data  — most reliable
 * 2. Open Graph meta tags                         — fallback for title/image
 * 3. Heuristic DOM selectors                      — last resort
 *
 * This class is stateless — one instance can be reused across pages.
 */

import type { Page } from 'playwright';
import type { RawScrapedProduct, RawPrice, RawVariant } from '../parsers/parser.types';

/** CSS selectors tried in order for product title (heuristic fallback) */
const TITLE_SELECTORS = [
    'h1[itemprop="name"]',
    '.product-title',
    '.product__title',
    'h1',
];

/** CSS selectors tried in order for product description */
const DESCRIPTION_SELECTORS = [
    '[itemprop="description"]',
    '.product-description',
    '.product__description',
    '#product-description',
];

/** CSS selectors tried in order for price */
const PRICE_SELECTORS = [
    '[itemprop="price"]',
    '.price',
    '.product-price',
    '.product__price',
    '[class*="price"]',
];

/** Regex to strip non-numeric characters except decimal separator */
const PRICE_SANITIZE_REGEX = /[^0-9.,]/g;

export class PageExtractor {
    /**
     * Extracts structured product data from a page.
     * Tries schema.org JSON-LD first, then falls back to DOM heuristics.
     */
    async extract(page: Page, sourceUrl: string): Promise<RawScrapedProduct> {
        const [jsonLd, ogMeta] = await Promise.all([
            this.extractJsonLd(page),
            this.extractOpenGraph(page),
        ]);

        // If we got a complete schema.org record, prefer it entirely
        if (jsonLd && jsonLd.title) {
            return { sourceUrl, ...jsonLd };
        }

        // Merge: OG meta fills gaps in schema.org data
        const dom = await this.extractDomHeuristics(page);

        return {
            sourceUrl,
            title: jsonLd?.title ?? ogMeta.title ?? dom.title,
            description: jsonLd?.description ?? ogMeta.description ?? dom.description,
            price: jsonLd?.price ?? dom.price,
            imageUrls: [
                ...(jsonLd?.imageUrls ?? []),
                ...(ogMeta.imageUrl ? [ogMeta.imageUrl] : []),
                ...(dom.imageUrls ?? []),
            ].filter((v, i, arr) => arr.indexOf(v) === i), // deduplicate
            variants: jsonLd?.variants ?? dom.variants ?? [],
            meta: ogMeta.extra,
        };
    }

    // ─── Schema.org JSON-LD ────────────────────────────────────────────────────

    private async extractJsonLd(page: Page): Promise<Partial<RawScrapedProduct> | null> {
        try {
            const jsonLdScripts = await page.$$eval(
                'script[type="application/ld+json"]',
                (scripts) => scripts.map((s) => s.textContent ?? ''),
            );

            for (const raw of jsonLdScripts) {
                let parsed: any;
                try { parsed = JSON.parse(raw); } catch { continue; }

                // Handle both single object and @graph array
                const nodes: any[] = parsed['@graph'] ?? [parsed];
                const product = nodes.find(
                    (n: any) => n['@type'] === 'Product' || n['@type']?.includes?.('Product'),
                );

                if (!product) continue;

                const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                const price: RawPrice | undefined = offers?.price
                    ? { amount: String(offers.price), currency: offers.priceCurrency }
                    : undefined;

                const imageUrls: string[] = [];
                if (typeof product.image === 'string') imageUrls.push(product.image);
                else if (Array.isArray(product.image)) imageUrls.push(...product.image.map((i: any) => typeof i === 'string' ? i : i?.url).filter(Boolean));
                else if (product.image?.url) imageUrls.push(product.image.url);

                const variants: RawVariant[] = (product.hasVariant ?? []).map((v: any) => ({
                    sku: v.sku,
                    price: v.offers?.price ? { amount: String(v.offers.price), currency: v.offers.priceCurrency } : undefined,
                    attributes: v.additionalProperty?.reduce(
                        (acc: Record<string, string>, prop: any) => { acc[prop.name] = prop.value; return acc; },
                        {},
                    ),
                }));

                return {
                    title: product.name,
                    description: product.description,
                    price,
                    imageUrls,
                    variants,
                };
            }
        } catch {
            // Extraction is best-effort — never throw 
        }
        return null;
    }

    // ─── Open Graph meta tags ──────────────────────────────────────────────────

    private async extractOpenGraph(page: Page): Promise<{
        title?: string;
        description?: string;
        imageUrl?: string;
        extra: Record<string, string>;
    }> {
        try {
            return await page.evaluate(() => {
                const getMeta = (property: string) =>
                    document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.content
                    ?? document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`)?.content;

                return {
                    title: getMeta('og:title') ?? getMeta('twitter:title'),
                    description: getMeta('og:description') ?? getMeta('description'),
                    imageUrl: getMeta('og:image') ?? getMeta('twitter:image'),
                    extra: {
                        'og:type': getMeta('og:type') ?? '',
                        'og:site_name': getMeta('og:site_name') ?? '',
                    },
                };
            });
        } catch {
            return { extra: {} };
        }
    }

    // ─── DOM heuristic selectors (last resort) ─────────────────────────────────

    private async extractDomHeuristics(page: Page): Promise<Partial<RawScrapedProduct>> {
        try {
            return await page.evaluate(
                ({ titleSelectors, descSelectors, priceSelectors }) => {
                    const trySelectors = (selectors: string[]): string | undefined => {
                        for (const sel of selectors) {
                            const el = document.querySelector(sel);
                            if (el?.textContent?.trim()) return el.textContent.trim();
                        }
                        return undefined;
                    };

                    const rawPrice = trySelectors(priceSelectors);
                    const imageUrls = Array.from(
                        document.querySelectorAll<HTMLImageElement>('img[src]'),
                    )
                        .map((img) => img.src)
                        .filter((src) => src && !src.includes('data:') && !src.includes('svg'))
                        .slice(0, 10); // cap to avoid noise

                    return {
                        title: trySelectors(titleSelectors),
                        description: trySelectors(descSelectors),
                        price: rawPrice ? { amount: rawPrice.replace(/[^0-9.,]/g, '') } : undefined,
                        imageUrls,
                        variants: [],
                    };
                },
                { titleSelectors: TITLE_SELECTORS, descSelectors: DESCRIPTION_SELECTORS, priceSelectors: PRICE_SELECTORS },
            );
        } catch {
            return {};
        }
    }
}
