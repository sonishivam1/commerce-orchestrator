import type { SourceConnector, TargetConnector } from '@cdo/core';
import type { CanonicalEntity } from '@cdo/shared';
import { SourcePlatform } from '@cdo/mapping';

import { CommercetoolsSourceConnector } from './commercetools/ct-source.connector';
import { CommercetoolsTargetConnector } from './commercetools/ct-target.connector';
import { ShopifySourceConnector } from './shopify/shopify-source.connector';
import { ShopifyTargetConnector } from './shopify/shopify-target.connector';

export class ConnectorFactory {
    static createSource(platform: SourcePlatform | string): SourceConnector<CanonicalEntity> {
        switch (platform) {
            case SourcePlatform.COMMERCETOOLS:
                return new CommercetoolsSourceConnector();
            case SourcePlatform.SHOPIFY:
                return new ShopifySourceConnector();
            default:
                throw new Error(`Unsupported source platform: ${platform}`);
        }
    }

    static createTarget(platform: SourcePlatform | string): TargetConnector<CanonicalEntity> {
        switch (platform) {
            case SourcePlatform.COMMERCETOOLS:
                return new CommercetoolsTargetConnector();
            case SourcePlatform.SHOPIFY:
                return new ShopifyTargetConnector();
            default:
                throw new Error(`Unsupported target platform: ${platform}`);
        }
    }
}
