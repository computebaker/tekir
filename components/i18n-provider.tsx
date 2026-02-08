/**
 * i18n Provider Component
 * 
 * Wraps the application with NextIntlClientProvider to enable internationalization.
 * Dynamically loads translation messages based on user's language preference.
 * Falls back to browser locale detection for unauthenticated users.
 * 
 * @see /.github/instructions/i18n.instructions.md
 */

'use client';

import { ReactNode, useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useSettings } from '@/lib/settings';
import { defaultLocale, isValidLocale, getLocaleFromBrowser } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import defaultMessages from '@/messages/en.json';
import trMessages from '@/messages/tr.json';

const MESSAGE_CACHE_PREFIX = 'tekir:i18n:messages';
const LAST_LOCALE_KEY = 'tekir:i18n:lastLocale';

const CACHE_VERSION =  `v${Date.now()}`;

const STATIC_MESSAGES: Partial<Record<Locale, Record<string, any>>> = {
  en: defaultMessages,
  tr: trMessages,
};

const buildCacheKey = (locale: Locale) => `${MESSAGE_CACHE_PREFIX}:${CACHE_VERSION}:${locale}`;

/**
 * Clean up old cached messages from previous versions
 */
const cleanupOldCache = () => {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MESSAGE_CACHE_PREFIX) && !key.includes(CACHE_VERSION)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.warn('[i18n] Failed to cleanup old cache:', error);
  }
};

const readCachedMessages = (locale: Locale): Record<string, any> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage.getItem(buildCacheKey(locale));
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    console.error(`[i18n] Failed to read cached messages for ${locale}:`, error);
    return null;
  }
};

const persistMessages = (locale: Locale, data: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildCacheKey(locale), JSON.stringify(data));
    window.localStorage.setItem(LAST_LOCALE_KEY, locale);
  } catch (error) {
    console.warn('[i18n] Failed to persist messages:', error);
  }
};

const getStoredLocale = (): Locale => {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  try {
    const storedLanguage = window.localStorage.getItem('language');
    
    if (storedLanguage && isValidLocale(storedLanguage)) {
      return storedLanguage as Locale;
    }

    const lastLocale = window.localStorage.getItem(LAST_LOCALE_KEY);
    
    if (lastLocale && isValidLocale(lastLocale)) {
      return lastLocale as Locale;
    }
  } catch (error) {
    console.warn('Error reading from localStorage:', error);
  }

  return getLocaleFromBrowser();
};

interface I18nProviderProps {
  children: ReactNode;
}

export default function I18nProvider({ children }: I18nProviderProps) {
  const { settings } = useSettings();
  const [bootLocale] = useState<Locale>(() => {
    // Clean up old cached translations on mount
    cleanupOldCache();
    return getStoredLocale();
  });
  const [messages, setMessages] = useState<Record<string, any>>(() => {
    const cached = readCachedMessages(bootLocale);
    if (cached) {
      return cached;
    }
    return STATIC_MESSAGES[bootLocale] ?? defaultMessages;
  });
  const [currentLocale, setCurrentLocale] = useState<Locale>(bootLocale);
  const [, setIsLoadingMessages] = useState(false);

  // Determine locale: user settings > browser detection > default
  const locale: Locale = (() => {
    if (settings.language && isValidLocale(settings.language)) {
      return settings.language as Locale;
    }
    return bootLocale;
  })();

  // Load translation messages for current locale
  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      // Only reload if locale actually changed
      if (currentLocale === locale) {
        return;
      }

      const cachedMessages = readCachedMessages(locale);
      if (cachedMessages && isMounted) {
        setMessages(cachedMessages);
        setCurrentLocale(locale);
        persistMessages(locale, cachedMessages);
        return;
      }

      const staticBundle = STATIC_MESSAGES[locale];
      if (staticBundle && isMounted) {
        setMessages(staticBundle);
        setCurrentLocale(locale);
        persistMessages(locale, staticBundle);
        return;
      }

      setIsLoadingMessages(true);

      try {
        const loadedMessages = await import(`@/messages/${locale}.json`);

        if (isMounted) {
          setMessages(loadedMessages.default);
          setCurrentLocale(locale);
          persistMessages(locale, loadedMessages.default);
        }
      } catch (error) {
        console.error(`Failed to load messages for locale "${locale}", falling back to "${defaultLocale}"`, error);

        const fallbackStatic = STATIC_MESSAGES[defaultLocale] ?? defaultMessages;

        if (isMounted) {
          setMessages(fallbackStatic);
          setCurrentLocale(defaultLocale);
          persistMessages(defaultLocale, fallbackStatic);
        }
      } finally {
        if (isMounted) {
          setIsLoadingMessages(false);
        }
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [locale, currentLocale]); // Removed 'messages' from dependencies

  // Always provide translations, falling back to the last loaded messages while new ones stream in
  const providerLocale = currentLocale;
  const providerMessages = messages || defaultMessages;

  return (
    <NextIntlClientProvider 
      key={providerLocale}
      locale={providerLocale}
      messages={providerMessages}
      timeZone="UTC"
      now={new Date()}
      // Prevent errors when translation keys are missing
      onError={(error) => {
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('i18n error:', error.message);
        }
      }}
      getMessageFallback={({ namespace, key }) => {
        // Return the key as fallback instead of throwing
        return `${namespace}.${key}`;
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
