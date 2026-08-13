import { ErrorType, CanonicalProduct, validateCanonicalProduct } from '@cdo/shared';
// Note: We're using CanonicalProductSchema directly or validating directly vs building custom error throws.
import { mapShopifyProduct, reverseMapShopifyProduct } from '../rules-engine/shopify.rules';
import { mapCommercetoolsProduct, reverseMapCommercetoolsProduct } from '../rules-engine/commercetools.rules';
import { mapScrapedProduct, ScrapedProductInput } from '../rules-engine/scrape.rules';

export enum SourcePlatform {
    SHOPIFY = 'SHOPIFY',
    COMMERCETOOLS = 'COMMERCETOOLS',
    SCRAPER = 'SCRAPER'
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
            case SourcePlatform.SCRAPER:
                unvalidatedProduct = mapScrapedProduct(rawPayload as ScrapedProductInput);
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

    fromCanonical(canonical: CanonicalProduct): any {
        switch (this.platform) {
            case SourcePlatform.SHOPIFY:
                return reverseMapShopifyProduct(canonical);
            case SourcePlatform.COMMERCETOOLS:
                return reverseMapCommercetoolsProduct(canonical);
            case SourcePlatform.SCRAPER:
                throw new Error('Cannot reverse map into a scraped product');
            default:
                throw new Error(`Unsupported target platform: ${this.platform}`);
        }
    }
}
