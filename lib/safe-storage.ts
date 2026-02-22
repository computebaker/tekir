/**
 * Safe localStorage utilities with sanitization and validation
 * to prevent XSS attacks through localStorage
 */

// Allowed characters for simple string values (alphanumeric, underscore, dash, dot, comma, space)
const SAFE_STRING_PATTERN = /^[a-zA-Z0-9_\-\.\,\s@]+$/;

// Maximum length for string values to prevent DoS
const MAX_STRING_LENGTH = 500;

// Maximum length for JSON stringified values
const MAX_JSON_LENGTH = 10000;

/**
 * Sanitizes a string value for safe storage in localStorage
 */
function sanitizeString(value: string): string {
  // Remove any characters that aren't in the safe set
  return value.replace(/[<>\"'`\\]/g, '').substring(0, MAX_STRING_LENGTH);
}

/**
 * Validates a value before storing in localStorage
 */
function validateValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.length <= MAX_STRING_LENGTH;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return true;
  }

  // For objects, check JSON length
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length <= MAX_JSON_LENGTH;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Sanitizes a value for safe storage in localStorage
 */
export function sanitizeForStorage<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value) as T;
  }

  if (typeof value === 'object') {
    // Recursively sanitize object properties
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Sanitize keys as well
      const safeKey = sanitizeString(key);
      if (validateValue(val)) {
        sanitized[safeKey] = val;
      }
    }
    return sanitized as T;
  }

  return value;
}

/**
 * Safely gets an item from localStorage with validation
 */
export function safeGetItem<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return null;
    }

    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(value) as T;
      // Validate the parsed value
      if (validateValue(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      // Not JSON, return as string if valid
      if (value.length <= MAX_STRING_LENGTH) {
        return value as T;
      }
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Safely sets an item in localStorage with sanitization
 */
export function safeSetItem<T>(key: string, value: T): boolean {
  try {
    // Sanitize key
    const safeKey = sanitizeString(key);

    // Sanitize value
    const sanitizedValue = sanitizeForStorage(value);

    // Validate before storing
    if (!validateValue(sanitizedValue)) {
      console.warn(`[SafeStorage] Value validation failed for key: ${safeKey}`);
      return false;
    }

    // Convert to JSON if object
    const storedValue = typeof sanitizedValue === 'object'
      ? JSON.stringify(sanitizedValue)
      : String(sanitizedValue);

    localStorage.setItem(safeKey, storedValue);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[SafeStorage] Failed to set item:', error);
    }
    return false;
  }
}

/**
 * Safely removes an item from localStorage
 */
export function safeRemoveItem(key: string): void {
  try {
    const safeKey = sanitizeString(key);
    localStorage.removeItem(safeKey);
  } catch {
    // Ignore errors
  }
}

/**
 * Safely clears all localStorage items with Tekir prefix
 */
export function safeClearTekirStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // Only remove keys that are likely to be Tekir-related
        // (common settings keys, not keys from other apps)
        if (key.startsWith('search') ||
            key.startsWith('language') ||
            key.startsWith('theme') ||
            key.startsWith('weather') ||
            key === 'selectedLogo' ||
            key === 'customWeatherLocation') {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore errors
  }
}
