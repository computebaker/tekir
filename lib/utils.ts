import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Redirect utilities for authentication flow
export const REDIRECT_STORAGE_KEY = 'tekir_redirect_url';

export function storeRedirectUrl(url?: string) {
  if (typeof window === 'undefined') return;

  const currentUrl = url || window.location.href;
  // Only store if it's not an auth page
  if (!currentUrl.includes('/auth/')) {
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, currentUrl);
  }
}

export function getRedirectUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(REDIRECT_STORAGE_KEY);
}

export function clearRedirectUrl() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
}

export function getRedirectUrlWithFallback(fallback: string = '/'): string {
  const stored = getRedirectUrl();
  if (stored) {
    clearRedirectUrl(); // Clear after use
    return stored;
  }
  return fallback;
}