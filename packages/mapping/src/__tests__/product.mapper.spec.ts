import { ProductMapper, SourcePlatform } from '../mappers/product.mapper';
import { ErrorType } from '@cdo/shared';

describe('ProductMapper', () => {

    it('should map a Shopify product and validate it correctly', () => {
        const rawShopify = {
            id: 1001,
            title: 'Cool Shirt',
            body_html: '<p>A really cool shirt</p>',
            handle: 'cool-shirt',
            status: 'active',
            variants: [
                { id: 2001, sku: 'SKU-01', price: '19.99' },
                { id: 2002, sku: 'SKU-02', price: '21.00' }
            ],
            tags: 'Spring, Summer'
        };

        const mapper = new ProductMapper(SourcePlatform.SHOPIFY);
        const mapped = mapper.toCanonical(rawShopify);

        expect(mapped._version).toBe('v1');
        expect(mapped.key).toBe('shopify-1001');
        expect(mapped.name.en).toBe('Cool Shirt');
        expect(mapped.slug.en).toBe('cool-shirt');
        expect(mapped.isPublished).toBe(true);
        expect(mapped.categoryKeys).toEqual(['Spring', 'Summer']);
        
        expect(mapped.masterVariant.sku).toBe('SKU-01');
        expect(mapped.masterVariant.prices[0].centAmount).toBe(1999);
        
        expect(mapped.variants.length).toBe(1);
        expect(mapped.variants[0].sku).toBe('SKU-02');
        expect(mapped.variants[0].prices[0].centAmount).toBe(2100);
    });

    it('should throw ValidationError for bad CT product missing required name', () => {
        const rawCT = {
            id: 'ct-123',
            // Missing name which is required by Zod schema
            description: { en: 'Desc' },
            masterVariant: {
                sku: 'CT-SKU-1',
                prices: [{ value: { centAmount: 1000, currencyCode: 'USD', fractionDigits: 2 } }]
            }
        };

        const mapper = new ProductMapper(SourcePlatform.COMMERCETOOLS);
        
        // Assert throws typed error
        try {
            mapper.toCanonical(rawCT);
            fail('Should have thrown ValidationError');
        } catch (error: any) {
            expect(error.type).toBe(ErrorType.VALIDATION);
            expect(error.message).toContain('Validation failed');
            expect(error.message).toContain('name'); // Path 'name' missing
        }
    });

    it('should map a raw Scraper payload without a variant or ID safely', () => {
        const rawScraped = {
            url: 'https://example.com/item/1',
            title: 'Found Item',
            price: 5.50, // Float
            currency: 'EUR',
            inStock: false
        };

        const mapper = new ProductMapper(SourcePlatform.SCRAPER);
        const mapped = mapper.toCanonical(rawScraped);

        // Uses url base64 fallback key since no SKU
        expect(mapped.key).toBeDefined();
        expect(mapped.masterVariant.stockQuantity).toBe(0); // inStock false handled
        expect(mapped.masterVariant.prices[0].centAmount).toBe(550);
        expect(mapped.masterVariant.prices[0].currencyCode).toBe('EUR');
    });

});
