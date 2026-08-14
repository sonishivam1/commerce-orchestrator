import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';
import { ErrorType } from '@cdo/shared';
import { canonicalToCtProductDraft, buildCtUpdateActions } from '@cdo/mapping';
import {
    createApiBuilderFromCtpClient,
    ByProjectKeyRequestBuilder,
    ProductUpdateAction,
} from '@commercetools/platform-sdk';
import {
    ClientBuilder,
    AuthMiddlewareOptions,
    HttpMiddlewareOptions,
} from '@commercetools/sdk-client-v2';
import fetch from 'node-fetch';

/**
 * Wraps a Commercetools API error and annotates it with the appropriate
 * ErrorType so the EtlEngine can make smart retry / circuit-breaker decisions.
 */
function classifyCtError(error: unknown): Error {
    const e = error as any;
    const status: number = e.statusCode ?? e.status ?? 0;
    const typed = new Error(e.message ?? String(error));

    if (e.type) {
        // Already classified (e.g. VALIDATION from the mapping layer).
        (typed as any).type = e.type;
    } else if (status === 409) {
        // Concurrent modification — safe to retry after re-fetching version.
        (typed as any).type = ErrorType.TRANSIENT;
    } else if (status >= 400 && status < 500) {
        // Bad request, auth, not-found (shouldn't happen if we GET first), etc.
        (typed as any).type = ErrorType.VALIDATION;
    } else {
        // Network errors, 5xx, unknown — retryable.
        (typed as any).type = ErrorType.TRANSIENT;
    }

    return typed;
}

export class CommercetoolsTargetConnector implements TargetConnector<CanonicalProduct> {
    private client!: ByProjectKeyRequestBuilder;
    /** Fallback CT ProductType ID — used when canonical.customAttributes.productType is absent. */
    private defaultProductTypeId?: string;

    getCapabilities(): string[] {
        return ['insert', 'update'];
    }

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        const {
            projectKey,
            clientId,
            clientSecret,
            authUrl = 'https://auth.europe-west1.gcp.commercetools.com',
            apiUrl  = 'https://api.europe-west1.gcp.commercetools.com',
            defaultProductTypeId,
        } = credentials;

        if (!projectKey || !clientId || !clientSecret) {
            throw new Error(
                'Missing required Commercetools credentials (projectKey, clientId, clientSecret)',
            );
        }

        this.defaultProductTypeId = defaultProductTypeId as string | undefined;

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

        this.client = createApiBuilderFromCtpClient(ctpClient).withProjectKey({
            projectKey: projectKey as string,
        });
    }

    /**
     * Upserts a single CanonicalProduct into Commercetools.
     * - Fetches the existing product by key.
     * - If found: applies the minimal set of update actions.
     * - If not found (404): creates a fresh ProductDraft.
     * - On 409 ConcurrentModification: re-fetches and retries once.
     */
    private async upsertProduct(canonical: CanonicalProduct): Promise<void> {
        const productTypeId =
            (canonical.customAttributes?.productType as string | undefined) ||
            this.defaultProductTypeId;

        if (!productTypeId) {
            const err = new Error(
                `Product "${canonical.key}" cannot be loaded to Commercetools: ` +
                `no productTypeId found in canonical.customAttributes.productType ` +
                `or credentials.defaultProductTypeId.`,
            );
            (err as any).type = ErrorType.VALIDATION;
            throw err;
        }

        // ── Fetch existing product ────────────────────────────────────────────
        let existing: Record<string, unknown> | null = null;
        try {
            const res = await this.client.products().withKey({ key: canonical.key }).get().execute();
            existing = res.body as unknown as Record<string, unknown>;
        } catch (err: any) {
            if (err.statusCode !== 404) throw err;
            // 404 → product doesn't exist yet → create path.
        }

        if (existing) {
            // ── Update path ──────────────────────────────────────────────────
            const actions = buildCtUpdateActions(canonical, existing);
            if (actions.length === 0) return; // Nothing to do.

            try {
                await this.client
                    .products()
                    .withKey({ key: canonical.key })
                    .post({
                        body: {
                            version: existing.version as number,
                            actions: actions as unknown as ProductUpdateAction[],
                        },
                    })
                    .execute();
            } catch (err: any) {
                if (err.statusCode === 409) {
                    // ConcurrentModification — re-fetch and retry once.
                    const refreshed = await this.client
                        .products()
                        .withKey({ key: canonical.key })
                        .get()
                        .execute();

                    const refreshedBody = refreshed.body as unknown as Record<string, unknown>;
                    const retryActions = buildCtUpdateActions(canonical, refreshedBody);
                    if (retryActions.length > 0) {
                        await this.client
                            .products()
                            .withKey({ key: canonical.key })
                            .post({
                                body: {
                                    version: refreshedBody.version as number,
                                    actions: retryActions as unknown as ProductUpdateAction[],
                                },
                            })
                            .execute();
                    }
                } else {
                    throw err;
                }
            }
        } else {
            // ── Create path ──────────────────────────────────────────────────
            const draft = canonicalToCtProductDraft(canonical, productTypeId);
            await this.client.products().post({ body: draft as any }).execute();
        }
    }

    async load(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];

        for (const canonical of batch) {
            try {
                await this.upsertProduct(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: unknown) {
                const classified = classifyCtError(error);
                results.push({
                    key: canonical.key,
                    success: false,
                    error: classified.message,
                });
            }
        }

        return results;
    }
}
