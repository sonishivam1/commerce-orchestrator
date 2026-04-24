import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { 
    createApiBuilderFromCtpClient, 
    ByProjectKeyRequestBuilder 
} from '@commercetools/platform-sdk';
import { ClientBuilder, AuthMiddlewareOptions, HttpMiddlewareOptions } from '@commercetools/sdk-client-v2';
import fetch from 'node-fetch';

export class CommercetoolsTargetConnector implements TargetConnector<CanonicalProduct> {
    private client!: ByProjectKeyRequestBuilder;

    getCapabilities(): string[] {
        return ['insert', 'update'];
    }

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
            scopes: [`manage_products:${projectKey}`],
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
            .build();

        this.client = createApiBuilderFromCtpClient(ctpClient).withProjectKey({ projectKey: projectKey as string });
    }

    async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];

        for (const item of batch) {
            try {
                // TODO: Proper reverse mapping via @cdo/mapping ProductMapper.fromCanonical()
                // For now, fail gracefully per-item to emit DLQ events
                throw new Error('Target mutation not fully implemented: Requires ProductType & Category resolution');

                // results.push({ key: item.key, success: true });
            } catch (error) {
                results.push({
                    key: item.key,
                    success: false,
                    error: (error as Error).message,
                });
            }
        }

        return results;
    }
}
