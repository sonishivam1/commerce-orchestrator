import type { SourceConnector } from '@cdo/core';
import type { CanonicalProduct, CanonicalVariant, CanonicalEntity } from '@cdo/shared';
import { EntityType, ErrorType } from '@cdo/shared';
import fetch from 'node-fetch';

export class BigCommerceSourceConnector implements SourceConnector<CanonicalEntity> {
    private baseUrl!: string;
    private accessToken!: string;

    constructor(private readonly entityType: EntityType = EntityType.PRODUCTS) {}

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const { storeHash, accessToken } = credentials;
        if (!storeHash || !accessToken) {
            throw new Error('Missing required BigCommerce credentials (storeHash, accessToken)');
        }
        this.baseUrl = `https://api.bigcommerce.com/stores/${storeHash as string}/v3`;
        this.accessToken = accessToken as string;
    }

    private async fetchPage(page: number): Promise<{ data: any[]; meta: any }> {
        const url = `${this.baseUrl}/catalog/products?include=variants,images&limit=50&page=${page}`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'X-Auth-Token': this.accessToken,
            },
        });
        if (!response.ok) {
            const body = await response.text();
            const err = new Error(`BigCommerce API ${response.status}: ${body}`);
            (err as any).statusCode = response.status;
            throw err;
        }
        return response.json() as Promise<{ data: any[]; meta: any }>;
    }

    private mapProduct(bc: any): CanonicalProduct {
        const images = (bc.images ?? [])
            .map((img: any) => img.url_standard || img.url_zoom || '')
            .filter(Boolean);

        const masterVariant: CanonicalVariant = {
            sku: bc.sku || String(bc.id),
            prices: bc.price != null
                ? [{ centAmount: Math.round(bc.price * 100), currencyCode: 'USD', fractionDigits: 2 }]
                : [],
            attributes: {},
            images,
            stockQuantity: bc.inventory_level ?? undefined,
        };

        const variants: CanonicalVariant[] = (bc.variants ?? []).slice(1).map((v: any) => ({
            sku: v.sku || String(v.id),
            prices: v.price != null
                ? [{ centAmount: Math.round(v.price * 100), currencyCode: 'USD', fractionDigits: 2 }]
                : [],
            attributes: (v.option_values ?? []).reduce(
                (acc: Record<string, string>, opt: any) => {
                    acc[opt.option_display_name] = opt.label;
                    return acc;
                },
                {} as Record<string, string>,
            ),
            images: v.image_url ? [v.image_url] : [],
            stockQuantity: v.inventory_level ?? undefined,
        }));

        return {
            _version: 'v1',
            key: `bc-${bc.id}`,
            name: { en: bc.name || String(bc.id) },
            description: { en: bc.description ? bc.description.replace(/<[^>]+>/g, ' ').trim() : '' },
            slug: { en: bc.custom_url?.url?.replace(/^\/|\/$/g, '') || `bc-${bc.id}` },
            categoryKeys: (bc.categories ?? []).map((id: number) => `bc-category-${id}`),
            isPublished: bc.is_visible !== false,
            masterVariant,
            variants,
            customAttributes: {
                bcId: bc.id,
                type: bc.type,
            },
        };
    }

    async *extract(cursor?: string): AsyncIterableIterator<CanonicalEntity[]> {
        if (this.entityType !== EntityType.PRODUCTS) {
            const err = new Error(`BigCommerce source connector currently only supports PRODUCTS entity type (requested: ${this.entityType})`);
            (err as any).type = ErrorType.FATAL;
            throw err;
        }

        let page = cursor ? parseInt(cursor, 10) : 1;
        let hasMore = true;

        while (hasMore) {
            const { data, meta } = await this.fetchPage(page);
            const pagination = meta?.pagination ?? {};

            const batch: CanonicalEntity[] = [];
            for (const bc of data) {
                try {
                    batch.push(this.mapProduct(bc));
                } catch (error) {
                    // VALIDATION-level mapping error — skip item, continue batch
                    const e = error as Error & { type?: ErrorType };
                    if (e.type !== ErrorType.FATAL) continue;
                    throw error;
                }
            }

            if (batch.length > 0) {
                yield batch;
            }

            hasMore = pagination.current_page < pagination.total_pages;
            page++;
        }
    }
}
