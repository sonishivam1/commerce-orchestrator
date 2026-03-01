import type { CanonicalProduct } from '@cdo/shared';

/**
 * Base interface for all entity mappers.
 * TRaw = platform-specific raw object (e.g. Shopify ProductNode)
 * TCanonical = target Canonical model
 */
export interface EntityMapper<TRaw, TCanonical> {
    toCanonical(raw: TRaw): TCanonical;
    fromCanonical(canonical: TCanonical): TRaw;
}

/**
 * Stub product mapper. Each platform will implement EntityMapper<PlatformProduct, CanonicalProduct>.
 */
export class ProductMapper implements EntityMapper<Record<string, unknown>, CanonicalProduct> {
    toCanonical(raw: Record<string, unknown>): CanonicalProduct {
        // TODO: Implement per-platform mapping logic or delegate to AI fallback
        throw new Error('ProductMapper.toCanonical not implemented');
    }

    fromCanonical(canonical: CanonicalProduct): Record<string, unknown> {
        // TODO: Implement reverse mapping per target platform
        throw new Error('ProductMapper.fromCanonical not implemented');
    }
}
