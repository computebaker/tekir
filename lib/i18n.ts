/**
 * Internationalization (i18n) Configuration
 * 
 * Defines supported locales, metadata, and browser detection utilities
 * for Tekir's client-side language switching.
 * 
 * @see /.github/instructions/i18n.instructions.md
 */

export const locales = ['en', 'tr'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export interface LocaleMetadata {
  name: string;
  flag: string;
  nativeName: string;
}

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: { name: 'English', flag: '🇺🇸', nativeName: 'English' },
  tr: { name: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
};

/**
 * Detects the user's preferred language from browser settings.
 * Falls back to defaultLocale if no match found.
 * 
 * @returns Locale code ('en', 'tr', etc.)
 */
export function getLocaleFromBrowser(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  
  try {
    // Get browser language (e.g., 'en-US', 'tr-TR')
    const browserLanguage = navigator.language.split('-')[0];
    
    // Check if it's in our supported locales
    return locales.includes(browserLanguage as Locale) 
      ? (browserLanguage as Locale)
      : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

/**
 * Validates if a given locale code is supported.
 * 
 * @param locale - Locale code to validate
 * @returns true if locale is supported
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
