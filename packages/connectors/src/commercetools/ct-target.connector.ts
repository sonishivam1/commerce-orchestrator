import type { TargetConnector, LoadResult } from '@cdo/core';
import type { CanonicalEntity, CanonicalProduct, CanonicalCategory, CanonicalCustomer } from '@cdo/shared';
import { EntityType, ErrorType } from '@cdo/shared';
import {
    canonicalToCtProductDraft,
    buildCtUpdateActions,
    canonicalToCtCategoryDraft,
    canonicalToCtCustomerDraft,
    SourcePlatform,
} from '@cdo/mapping';
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

// Scopes required per entity type for target operations
const TARGET_SCOPE_MAP: Record<EntityType, string[]> = {
    [EntityType.PRODUCTS]: ['manage_products'],
    [EntityType.CATEGORIES]: ['manage_categories'],
    [EntityType.CUSTOMERS]: ['manage_customers'],
    [EntityType.ORDERS]: ['manage_orders'],
};

/**
 * Wraps a Commercetools API error and annotates it with the appropriate
 * ErrorType so the EtlEngine can make smart retry / circuit-breaker decisions.
 */
function classifyCtError(error: unknown): Error {
    const e = error as any;
    const status: number = e.statusCode ?? e.status ?? 0;
    const typed = new Error(e.message ?? String(error));

    if (e.type) {
        (typed as any).type = e.type;
    } else if (status === 409) {
        (typed as any).type = ErrorType.TRANSIENT;
    } else if (status >= 400 && status < 500) {
        (typed as any).type = ErrorType.VALIDATION;
    } else {
        (typed as any).type = ErrorType.TRANSIENT;
    }

    return typed;
}

export class CommercetoolsTargetConnector implements TargetConnector<CanonicalEntity> {
    private client!: ByProjectKeyRequestBuilder;
    /** Fallback CT ProductType ID — used when canonical.customAttributes.productType is absent. */
    private defaultProductTypeId?: string;

    constructor(private readonly entityType: EntityType = EntityType.PRODUCTS) {}

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

        const scopes = TARGET_SCOPE_MAP[this.entityType] ?? ['manage_products'];
        const scopesWithProject = scopes.map(s => `${s}:${projectKey}`);

        const authMiddlewareOptions: AuthMiddlewareOptions = {
            host: authUrl as string,
            projectKey: projectKey as string,
            credentials: {
                clientId: clientId as string,
                clientSecret: clientSecret as string,
            },
            scopes: scopesWithProject,
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

    async load(batch: CanonicalEntity[]): Promise<LoadResult[]> {
        switch (this.entityType) {
            case EntityType.PRODUCTS:
                return this.loadProducts(batch as CanonicalProduct[]);
            case EntityType.CATEGORIES:
                return this.loadCategories(batch as CanonicalCategory[]);
            case EntityType.CUSTOMERS:
                return this.loadCustomers(batch as CanonicalCustomer[]);
            default: {
                const err = new Error(`Unsupported entity type for CT target: ${this.entityType}`);
                (err as any).type = ErrorType.VALIDATION;
                throw err;
            }
        }
    }

    // ── Products ─────────────────────────────────────────────────────────────────

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

        let existing: Record<string, unknown> | null = null;
        try {
            const res = await this.client.products().withKey({ key: canonical.key }).get().execute();
            existing = res.body as unknown as Record<string, unknown>;
        } catch (err: any) {
            if (err.statusCode !== 404) throw err;
        }

        if (existing) {
            const actions = buildCtUpdateActions(canonical, existing);
            if (actions.length === 0) return;

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
                    const refreshed = await this.client.products().withKey({ key: canonical.key }).get().execute();
                    const refreshedBody = refreshed.body as unknown as Record<string, unknown>;
                    const retryActions = buildCtUpdateActions(canonical, refreshedBody);
                    if (retryActions.length > 0) {
                        await this.client
                            .products()
                            .withKey({ key: canonical.key })
                            .post({ body: { version: refreshedBody.version as number, actions: retryActions as unknown as ProductUpdateAction[] } })
                            .execute();
                    }
                } else {
                    throw err;
                }
            }
        } else {
            const draft = canonicalToCtProductDraft(canonical, productTypeId);
            await this.client.products().post({ body: draft as any }).execute();
        }
    }

    private async loadProducts(batch: CanonicalProduct[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];
        for (const canonical of batch) {
            try {
                await this.upsertProduct(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: unknown) {
                const classified = classifyCtError(error);
                results.push({ key: canonical.key, success: false, error: classified.message });
            }
        }
        return results;
    }

    // ── Categories ───────────────────────────────────────────────────────────────

    private async upsertCategory(canonical: CanonicalCategory): Promise<void> {
        const draft = canonicalToCtCategoryDraft(canonical);

        let existing: Record<string, unknown> | null = null;
        try {
            const res = await this.client.categories().withKey({ key: canonical.key }).get().execute();
            existing = res.body as unknown as Record<string, unknown>;
        } catch (err: any) {
            if (err.statusCode !== 404) throw err;
        }

        if (existing) {
            // Build minimal update actions for name and slug changes
            const actions: any[] = [];
            const existingName = (existing as any).name ?? {};
            const existingSlug = (existing as any).slug ?? {};

            for (const [locale, value] of Object.entries(canonical.name)) {
                if (existingName[locale] !== value) {
                    actions.push({ action: 'changeName', name: canonical.name });
                    break;
                }
            }
            for (const [locale, value] of Object.entries(canonical.slug)) {
                if (existingSlug[locale] !== value) {
                    actions.push({ action: 'changeSlug', slug: canonical.slug });
                    break;
                }
            }

            if (actions.length > 0) {
                await this.client
                    .categories()
                    .withKey({ key: canonical.key })
                    .post({ body: { version: existing.version as number, actions } })
                    .execute();
            }
        } else {
            await this.client.categories().post({ body: draft as any }).execute();
        }
    }

    private async loadCategories(batch: CanonicalCategory[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];
        for (const canonical of batch) {
            try {
                await this.upsertCategory(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: unknown) {
                const classified = classifyCtError(error);
                results.push({ key: canonical.key, success: false, error: classified.message });
            }
        }
        return results;
    }

    // ── Customers ─────────────────────────────────────────────────────────────────

    private async upsertCustomer(canonical: CanonicalCustomer): Promise<void> {
        const draft = canonicalToCtCustomerDraft(canonical);

        let existing: Record<string, unknown> | null = null;
        try {
            const res = await this.client.customers().withKey({ key: canonical.key }).get().execute();
            existing = res.body as unknown as Record<string, unknown>;
        } catch (err: any) {
            if (err.statusCode !== 404) throw err;
        }

        if (existing) {
            // Build update actions for email/name changes
            const actions: any[] = [];
            const existingCustomer = existing as any;

            if (existingCustomer.email !== canonical.email) {
                actions.push({ action: 'changeEmail', email: canonical.email });
            }
            if (existingCustomer.firstName !== canonical.firstName) {
                actions.push({ action: 'setFirstName', firstName: canonical.firstName });
            }
            if (existingCustomer.lastName !== canonical.lastName) {
                actions.push({ action: 'setLastName', lastName: canonical.lastName });
            }

            if (actions.length > 0) {
                await this.client
                    .customers()
                    .withKey({ key: canonical.key })
                    .post({ body: { version: existing.version as number, actions } })
                    .execute();
            }
        } else {
            // CT requires a password for customer creation; use a random one that must be reset
            const draftWithPassword = { ...draft, password: `Temp!${canonical.key}` };
            await this.client.customers().post({ body: draftWithPassword as any }).execute();
        }
    }

    private async loadCustomers(batch: CanonicalCustomer[]): Promise<LoadResult[]> {
        const results: LoadResult[] = [];
        for (const canonical of batch) {
            try {
                await this.upsertCustomer(canonical);
                results.push({ key: canonical.key, success: true });
            } catch (error: unknown) {
                const classified = classifyCtError(error);
                results.push({ key: canonical.key, success: false, error: classified.message });
            }
        }
        return results;
    }
}
