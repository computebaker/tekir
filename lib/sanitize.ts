/**
 * Input sanitization utilities
 * Helps prevent XSS, injection attacks, and other input-based vulnerabilities
 */

/**
 * Dangerous protocols that should be stripped from input
 */
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'vbscript:',
  'data:',
  'file:',
  'ftp:',
  'about:',
] as const;

/**
 * Check if a URL is from a trusted host
 *
 * Security: Properly parses the URL and validates the hostname against an allowlist.
 * This prevents bypass attempts where malicious URLs embed trusted domains in unexpected locations.
 *
 * @param url - The URL to validate
 * @param allowedHosts - Array of trusted hostnames
 * @returns true if the URL is from a trusted host, false otherwise
 *
 * @example
 * isTrustedUrl('https://api.dicebear.com/avatar', ['api.dicebear.com']) // true
 * isTrustedUrl('https://evil.com/api.dicebear.com', ['api.dicebear.com']) // false
 * isTrustedUrl('https://api.dicebear.com.evil.com', ['api.dicebear.com']) // false
 */
export function isTrustedUrl(url: string, allowedHosts: string[]): boolean {
  try {
    const parsed = new URL(url);
    return allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Sanitize string input by removing potentially dangerous characters
 *
 * Security: Uses iterative replacement to prevent multi-character bypass attacks.
 * For example, "javajavascript:script:" becomes "javascript:" after one pass,
 * but the loop continues until no more dangerous patterns remain.
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();
  let previous: string;

  // Iteratively remove dangerous patterns until no more changes occur
  // This prevents bypass attempts like "javajavascript:script:"
  const protocolPattern = new RegExp(DANGEROUS_PROTOCOLS.join('|'), 'gi');

  do {
    previous = sanitized;
    sanitized = sanitized
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(protocolPattern, '') // Remove dangerous protocols
      .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
  } while (sanitized !== previous);

  return sanitized;
}

/**
 * Sanitize email address
 *
 * Security: Removes dangerous protocols and HTML tags from email addresses.
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  const protocolPattern = new RegExp(DANGEROUS_PROTOCOLS.join('|'), 'gi');

  return email
    .trim()
    .toLowerCase()
    .replace(/[<>]/g, '')
    .replace(protocolPattern, '');
}

/**
 * Sanitize username
 * Only allows alphanumeric characters, underscores, and hyphens
 */
export function sanitizeUsername(username: string): string {
  if (typeof username !== 'string') {
    return '';
  }

  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}

/**
 * Sanitize user input for display (HTML escaping)
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return '';
  }

  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validate and sanitize a URL
 *
 * Security: Only allows http and https protocols. All other protocols including
 * javascript:, vbscript:, data:, file:, ftp:, about: are rejected.
 *
 * This function uses URL parsing which handles protocol validation correctly
 * and prevents bypass attempts via protocol confusion.
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }

  try {
    // Parse URL to properly extract protocol and validate structure
    const parsed = new URL(url.trim());

    // Only allow http and https protocols
    // This blocks: javascript:, vbscript:, data:, file:, ftp:, about:, etc.
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    return parsed.toString();
  } catch {
    // Invalid URL format
    return '';
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 * Must be 3-30 characters, alphanumeric, underscores, and hyphens only
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength
 * At least 8 characters, contains at least one letter and one number
 */
export function isValidPassword(password: string): boolean {
  if (typeof password !== 'string' || password.length < 8) {
    return false;
  }

  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return hasLetter && hasNumber;
}

/**
 * Sanitize object by recursively sanitizing all string values
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Truncate string to maximum length
 */
export function truncate(str: string, maxLength: number): string {
  if (typeof str !== 'string') {
    return '';
  }

  if (str.length <= maxLength) {
    return str;
  }

  return str.slice(0, maxLength);
}

/**
 * Validate and sanitize user input with constraints
 */
export interface ValidationOptions {
  maxLength?: number;
  minLength?: number;
  allowedChars?: RegExp;
  required?: boolean;
}

export function validateInput(
  input: string,
  options: ValidationOptions
): { valid: boolean; sanitized?: string; error?: string } {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Input must be a string' };
  }

  let sanitized = input.trim();

  // Check required
  if (options.required && sanitized.length === 0) {
    return { valid: false, error: 'This field is required' };
  }

  // Check min length
  if (options.minLength && sanitized.length < options.minLength) {
    return {
      valid: false,
      error: `Must be at least ${options.minLength} characters`,
    };
  }

  // Check max length
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = truncate(sanitized, options.maxLength);
  }

  // Check allowed characters
  if (options.allowedChars && !options.allowedChars.test(sanitized)) {
    return {
      valid: false,
      error: 'Contains invalid characters',
    };
  }

  return { valid: true, sanitized };
}

/**
 * Sanitize search query
 * Removes dangerous characters but preserves search functionality
 *
 * Security: Uses iterative replacement to prevent multi-character bypass attacks.
 * Limits query length to prevent DoS attacks.
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    return '';
  }

  let sanitized = query.trim().slice(0, 200); // Limit length first
  let previous: string;

  const protocolPattern = new RegExp(DANGEROUS_PROTOCOLS.join('|'), 'gi');

  do {
    previous = sanitized;
    sanitized = sanitized
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(protocolPattern, ''); // Remove dangerous protocols
  } while (sanitized !== previous);

  return sanitized;
}
