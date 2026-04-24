import type { SourceConnector } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { ProductMapper, SourcePlatform } from '@cdo/mapping';
import { 
    createApiBuilderFromCtpClient, 
    ByProjectKeyRequestBuilder 
} from '@commercetools/platform-sdk';
import { ClientBuilder, AuthMiddlewareOptions, HttpMiddlewareOptions } from '@commercetools/sdk-client-v2';
import fetch from 'node-fetch';

export class CommercetoolsSourceConnector implements SourceConnector<CanonicalProduct> {
    private client!: ByProjectKeyRequestBuilder;
    private readonly mapper = new ProductMapper(SourcePlatform.COMMERCETOOLS);

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const {
            projectKey,
            clientId,
            clientSecret,
            authUrl = 'https://auth.europe-west1.gcp.commercetools.com',
            apiUrl = 'https://api.europe-west1.gcp.commercetools.com',
        } = credentials;

        if (!projectKey || !clientId || !clientSecret) {
            throw new Error('Missing required Commercetools credentials');
        }

        const authMiddlewareOptions: AuthMiddlewareOptions = {
            host: authUrl as string,
            projectKey: projectKey as string,
            credentials: {
                clientId: clientId as string,
                clientSecret: clientSecret as string,
            },
            scopes: [`view_products:${projectKey}`],
            fetch,
        };

        const httpMiddlewareOptions: HttpMiddlewareOptions = {
            host: apiUrl as string,
            fetch,
        };

        const ctpClient = new ClientBuilder()
            .withProjectKey(projectKey as string)
            .withClientCredentialsFlow(authMiddlewareOptions)
            .withHttpMiddleware(httpMiddlewareOptions)
            // No logging middleware to avoid credential/PII leaks
            .build();

        this.client = createApiBuilderFromCtpClient(ctpClient).withProjectKey({ projectKey: projectKey as string });
    }

    async *extract(cursor?: string): AsyncIterableIterator<CanonicalProduct[]> {
        let lastId = cursor;
        let hasMore = true;

        while (hasMore) {
            const response = await this.client.products().get({
                queryArgs: {
                    limit: 50,
                    sort: 'id asc',
                    where: lastId ? `id > "${lastId}"` : undefined,
                    withTotal: false, // For performance per CT docs
                }
            }).execute();

            const results = response.body.results;

            if (results.length === 0) {
                hasMore = false;
                break;
            }

            const mappedBatch: CanonicalProduct[] = [];

            for (const item of results) {
                try {
                    const canonical = this.mapper.toCanonical(item);
                    mappedBatch.push(canonical);
                } catch (error) {
                    // For now, if a product fails mapping (e.g., validation fail), 
                    // we log it and drop it from the batch to avoid failing the whole pipeline.
                    // Ideally this would go to a DLQ from the source side.
                    console.error(`Skipping product ${item.id} due to mapping error:`, (error as Error).message);
                }
            }

            if (mappedBatch.length > 0) {
                yield mappedBatch;
            }

            lastId = results[results.length - 1].id;
        }
    }
}
