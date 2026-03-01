import type { SourceConnector } from '@cdo/core';
import type { CanonicalProduct } from '@cdo/shared';

export class CommercetoolsSourceConnector implements SourceConnector<CanonicalProduct> {
    private credentials: Record<string, unknown> = {};

    async initialize(credentials: Record<string, unknown>): Promise<void> {
        this.credentials = credentials;
        // TODO: Build CT API client using @commercetools/sdk-client-v2
    }

    async *extract(cursor?: string): AsyncIterableIterator<CanonicalProduct[]> {
        // TODO: Use CT Products query API, paginate via lastId cursor
        // TODO: Map CT Product -> CanonicalProduct via @cdo/mapping
        yield [];
    }
}
