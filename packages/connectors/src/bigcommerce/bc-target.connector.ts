import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { ErrorType } from '@cdo/shared';
import fetch from 'node-fetch';

export class BigCommerceTargetConnector implements TargetConnector<CanonicalProduct> {
    private baseUrl!: string;
    private accessToken!: string;

    getCapabilities(): string[] {
        return ['insert', 'update'];
    }

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const { storeHash, accessToken } = credentials;
        if (!storeHash || !accessToken) {
            throw new Error('Missing required BigCommerce credentials (storeHash, accessToken)');
        }
        this.baseUrl = `https://api.bigcommerce.com/stores/${storeHash as string}/v3`;
        this.accessToken = accessToken as string;
    }

    private async request(method: string, path: string, body?: unknown): Promise<any> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Auth-Token': this.accessToken,
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
            const text = await response.text();
            const err = new Error(`BigCommerce ${method} ${path} → ${response.status}: ${text}`);
            (err as any).statusCode = response.status;
            throw err;
        }

        const json = await response.json() as any;
        return json.data ?? json;
    }

    private canonicalToBcDraft(canonical: CanonicalProduct): Record<string, unknown> {
        const locale = Object.keys(canonical.name)[0] || 'en';
        const priceEntry = canonical.masterVariant.prices[0];
        const price = priceEntry
            ? priceEntry.centAmount / Math.pow(10, priceEntry.fractionDigits)
            : 0;

        return {
            name: canonical.name[locale] || canonical.key,
            description: canonical.description[locale] || '',
            sku: canonical.masterVariant.sku,
            price,
            is_visible: canonical.isPublished,
            custom_url: {
                url: `/${Object.values(canonical.slug)[0] || canonical.key}/`,
                is_customized: true,
            },
            type: 'physical',
        };
    }

    private async upsertProduct(canonical: CanonicalProduct): Promise<void> {
        // Try to find an existing product by SKU
        const searchRes = await this.request(
            'GET',
            `/catalog/products?sku=${encodeURIComponent(canonical.masterVariant.sku)}&limit=1`,
        );
        const existing = Array.isArray(searchRes) ? searchRes[0] : undefined;

        const draft = this.canonicalToBcDraft(canonical);

        if (existing) {
            await this.request('PUT', `/catalog/products/${existing.id}`, draft);
        } else {
            await this.request('POST', '/catalog/products', draft);
        }
    }

    async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];

        for (const canonical of batch) {
            try {
                await this.upsertProduct(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: any) {
                const status: number = error.statusCode ?? 0;
                const errorType =
                    status >= 400 && status < 500 && status !== 429
                        ? ErrorType.VALIDATION
                        : ErrorType.TRANSIENT;
                const typed = new Error(error.message);
                (typed as any).type = (error as any).type ?? errorType;
                results.push({ key: canonical.key, success: false, error: typed.message });
            }
        }

        return results;
    }
}
