import { Money, DEFAULT_CURRENCY } from '@cdo/shared';

/**
 * Normalizes different monetary formats into the Canonical Money object.
 * Always scales up to integer cents.
 * e.g., "1,200.50 USD" -> { centAmount: 120050, currencyCode: 'USD', fractionDigits: 2 }
 * e.g., 1200.5 -> { centAmount: 120050, currencyCode: 'USD', fractionDigits: 2 }
 */
export const normalizeMoney = (
    value: string | number,
    defaultCurrency = DEFAULT_CURRENCY
): Money => {
    if (typeof value === 'number') {
        return {
            centAmount: Math.round(value * 100),
            currencyCode: defaultCurrency,
            fractionDigits: 2
        };
    }

    const stringValue = value.trim();
    const amountMatch = stringValue.match(/[\d,]+(\.\d+)?/);
    const currencyMatch = stringValue.match(/[A-Z]{3}/) || stringValue.match(/[\$£€]/);

    let currencyCode = defaultCurrency;
    if (currencyMatch) {
         if (currencyMatch[0] === '$') currencyCode = DEFAULT_CURRENCY;
         else if (currencyMatch[0] === '£') currencyCode = 'GBP';
         else if (currencyMatch[0] === '€') currencyCode = 'EUR';
         else currencyCode = currencyMatch[0];
    }

    if (!amountMatch) {
        throw new Error(`Invalid money format: ${value}`);
    }

    const numericAmount = parseFloat(amountMatch[0].replace(/,/g, ''));
    
    return {
        centAmount: Math.round(numericAmount * 100),
        currencyCode,
        fractionDigits: 2
    };
};
