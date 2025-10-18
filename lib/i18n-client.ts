/**
 * Client-side i18n Utilities
 * 
 * Provides client-only locale utilities for browser-based language detection.
 * Used as fallback when user is not authenticated or settings are unavailable.
 * 
 * @see /.github/instructions/i18n.instructions.md
 */

'use client';

import { getLocaleFromBrowser, type Locale } from './i18n';

/**
 * Hook to get the current locale for client components.
 * In production, this should read from Convex settings via useSettings().
 * Falls back to browser locale detection for unauthenticated users.
 * 
 * @returns Current locale code
 */
export function useClientLocale(): Locale {
  return getLocaleFromBrowser();
}
