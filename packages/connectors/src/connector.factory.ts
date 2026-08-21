import type { SourceConnector, TargetConnector } from '@cdo/core';
import type { CanonicalEntity } from '@cdo/shared';
import { EntityType } from '@cdo/shared';
import { SourcePlatform } from '@cdo/mapping';

import { CommercetoolsSourceConnector } from './commercetools/ct-source.connector';
import { CommercetoolsTargetConnector } from './commercetools/ct-target.connector';
import { ShopifySourceConnector } from './shopify/shopify-source.connector';
import { ShopifyTargetConnector } from './shopify/shopify-target.connector';
import { BigCommerceSourceConnector } from './bigcommerce/bc-source.connector';
import { BigCommerceTargetConnector } from './bigcommerce/bc-target.connector';

export class ConnectorFactory {
    /**
     * Creates a SourceConnector for the given platform and entity type.
     * The platform string MUST match the lowercase Platform enum values stored in the DB
     * (e.g. 'commercetools', 'shopify', 'bigcommerce').
     */
    static createSource(
        platform: string,
        entityType: EntityType = EntityType.PRODUCTS,
    ): SourceConnector<CanonicalEntity> {
        switch (platform) {
            case SourcePlatform.COMMERCETOOLS:
                return new CommercetoolsSourceConnector(entityType);
            case SourcePlatform.SHOPIFY:
                return new ShopifySourceConnector(entityType);
            case SourcePlatform.BIGCOMMERCE:
                return new BigCommerceSourceConnector(entityType);
            default:
                throw new Error(`Unsupported source platform: ${platform}`);
        }
    }

    /**
     * Creates a TargetConnector for the given platform and entity type.
     */
    static createTarget(
        platform: string,
        entityType: EntityType = EntityType.PRODUCTS,
    ): TargetConnector<CanonicalEntity> {
        switch (platform) {
            case SourcePlatform.COMMERCETOOLS:
                return new CommercetoolsTargetConnector(entityType);
            case SourcePlatform.SHOPIFY:
                return new ShopifyTargetConnector(entityType);
            case SourcePlatform.BIGCOMMERCE:
                return new BigCommerceTargetConnector(entityType);
            default:
                throw new Error(`Unsupported target platform: ${platform}`);
        }
    }
}
