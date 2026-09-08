import { ErrorType, CanonicalProduct, validateCanonicalProduct } from '@cdo/shared';
// Note: We're using CanonicalProductSchema directly or validating directly vs building custom error throws.
import { mapShopifyProduct, canonicalToShopifyProductInput } from '../rules-engine/shopify.rules';
import { mapCommercetoolsProduct, canonicalToCtProductDraft } from '../rules-engine/commercetools.rules';

/**
 * SourcePlatform — mirrors Platform from @cdo/shared using the same lowercase values.
 * Kept here so @cdo/mapping stays decoupled from @cdo/shared while remaining compatible
 * with the platform strings stored in the database.
 */
export enum SourcePlatform {
    SHOPIFY = 'shopify',
    COMMERCETOOLS = 'commercetools',
    BIGCOMMERCE = 'bigcommerce',
}

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
 * ProductMapper implementation handling different platforms via the generic rules-engine logic
 */
export class ProductMapper implements EntityMapper<any, CanonicalProduct> {
    
    constructor(private readonly platform: SourcePlatform) {}

    toCanonical(rawPayload: any): CanonicalProduct {
        let unvalidatedProduct: CanonicalProduct;

        switch (this.platform) {
            case SourcePlatform.SHOPIFY:
                unvalidatedProduct = mapShopifyProduct(rawPayload);
                break;
            case SourcePlatform.COMMERCETOOLS:
                unvalidatedProduct = mapCommercetoolsProduct(rawPayload);
                break;
            default:
                const fatal = new Error(`Unsupported source platform: ${this.platform}`);
                (fatal as any).type = ErrorType.FATAL;
                throw fatal;
        }

        // Force Zod check
        const validationResult = validateCanonicalProduct(unvalidatedProduct);
        
        if (!validationResult.success) {
            const errorObj = (validationResult as any).error;
            const errorMsg = errorObj.errors 
                ? errorObj.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
                : errorObj.message;

            const error = new Error(`Validation failed for product ${unvalidatedProduct.key || 'unknown'}: ${errorMsg}`);
            (error as any).type = ErrorType.VALIDATION;
            throw error;
        }

        // Returning fully validated data
        return validationResult.data as CanonicalProduct;
    }

    /**
     * Converts a CanonicalProduct back to the platform-specific draft/input shape.
     *
     * For Commercetools the caller must supply `options.productTypeId` (or set
     * `canonical.customAttributes.productType`) because CT requires a ProductType
     * reference.  For Shopify the caller may optionally pass `options.existingId`
     * and `options.locationId`.
     */
    fromCanonical(canonical: CanonicalProduct, options?: Record<string, unknown>): any {
        switch (this.platform) {
            case SourcePlatform.SHOPIFY: {
                const existingId = options?.existingId as string | undefined;
                const locationId = options?.locationId as string | undefined;
                return canonicalToShopifyProductInput(canonical, existingId, locationId);
            }

            case SourcePlatform.COMMERCETOOLS: {
                const productTypeId =
                    (options?.productTypeId as string | undefined) ||
                    (canonical.customAttributes?.productType as string | undefined);

                if (!productTypeId) {
                    const err = new Error(
                        `fromCanonical(CT): product "${canonical.key}" has no productTypeId. ` +
                        `Pass options.productTypeId or set canonical.customAttributes.productType.`,
                    );
                    (err as any).type = ErrorType.VALIDATION;
                    throw err;
                }

                return canonicalToCtProductDraft(canonical, productTypeId);
            }

            default: {
                const err = new Error(`Unsupported platform for reverse mapping: ${this.platform}`);
                (err as any).type = ErrorType.FATAL;
                throw err;
            }
        }
    }
}
