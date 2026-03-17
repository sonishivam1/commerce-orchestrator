import { LocalizedString, DEFAULT_LOCALE } from '@cdo/shared';

/**
 * Flattens disparate string types or partial locale configurations
 * into a Canonical LocalizedString dictionary.
 * e.g., "Hello" -> { "en": "Hello" }
 */
export const normalizeLocaleString = (
    value: string | Record<string, string> | null | undefined,
    defaultLocale = DEFAULT_LOCALE
): LocalizedString => {
    if (!value) {
        return { [defaultLocale]: '' };
    }
    
    if (typeof value === 'string') {
        return { [defaultLocale]: value };
    }

    // Convert keys or simply map over the object
    const canonicalLocale: LocalizedString = {};
    for (const [key, val] of Object.entries(value)) {
        if (typeof val === 'string') {
            // we could map "US" to "en-US" here if required down the road
            canonicalLocale[key] = val;
        }
    }

    if (Object.keys(canonicalLocale).length === 0) {
        canonicalLocale[defaultLocale] = '';
    }

    return canonicalLocale;
};
