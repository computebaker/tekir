/**
 * Input sanitization utilities
 * Helps prevent XSS, injection attacks, and other input-based vulnerabilities
 */

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  return email
    .trim()
    .toLowerCase()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '');
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
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }

  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    // Remove javascript: and data: protocols
    if (url.startsWith('javascript:') || url.startsWith('data:')) {
      return '';
    }

    return parsed.toString();
  } catch {
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
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    return '';
  }

  return query
    .trim()
    .slice(0, 200) // Limit length
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '');
}
