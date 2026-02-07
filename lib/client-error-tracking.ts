'use client';

import { trackJSError } from '@/lib/posthog-analytics';

/**
 * Client-Side Error Tracking Utilities
 *
 * Provides functions for tracking different types of client-side errors:
 * - Component render errors (via Error Boundary)
 * - Async/Promise errors
 * - Hook errors
 * - User action errors
 * - Network/API errors
 * - Resource loading errors
 *
 * All errors are tracked via PostHog with consent awareness.
 */

// ============================================================================
// Error Types & Interfaces
// ============================================================================

export interface ClientErrorProperties {
  error_type: string;
  error_message: string;
  component?: string;
  user_action?: string;
  context?: Record<string, unknown>;
  stack_trace?: string;
  url?: string;
}

export interface AsyncErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Component & Render Error Tracking
// ============================================================================

/**
 * Track render errors caught by Error Boundary or try-catch blocks
 * Use this in componentDidCatch or error boundaries
 */
export function trackComponentError(
  error: Error,
  componentName: string,
  context?: Record<string, unknown>
): void {
  const errorType = error.name || 'ComponentRenderError';
  const errorMessage = error.message || 'Unknown error occurred';

  trackJSError({
    error_type: errorType,
    error_message: errorMessage,
    component: componentName,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_action: context?.userAction as string | undefined,
  });

  // Log additional context in development
  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[Client Error] ${componentName}:`,
      {
        error: errorMessage,
        stack: error.stack,
        context,
      }
    );
  }
}

// ============================================================================
// Async Operation Error Tracking
// ============================================================================

/**
 * Track errors from async operations (data fetching, API calls, etc.)
 * Use this in try-catch blocks within hooks or async functions
 *
 * Example:
 * try {
 *   const data = await fetchData();
 * } catch (error) {
 *   trackAsyncError(error, { operation: 'fetchUserData', component: 'ProfilePage' });
 * }
 */
export function trackAsyncError(
  error: unknown,
  context: AsyncErrorContext
): void {
  const errorObj = normalizeError(error);
  const { operation, component, userId, metadata } = context;

  trackJSError({
    error_type: errorObj.name || 'AsyncOperationError',
    error_message: errorObj.message,
    component: component || operation,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_action: operation,
  });

  // Log detailed information in development
  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[Async Error] ${operation}${component ? ` (${component})` : ''}:`,
      {
        error: errorObj.message,
        stack: errorObj.stack,
        userId,
        metadata,
      }
    );
  }
}

// ============================================================================
// Network & API Error Tracking
// ============================================================================

/**
 * Track network/fetch errors
 * Use this for API calls, data fetching, and network requests
 *
 * Example:
 * try {
 *   const response = await fetch('/api/search');
 *   if (!response.ok) throw new Error(`HTTP ${response.status}`);
 * } catch (error) {
 *   trackNetworkError(error, '/api/search', 'POST', context);
 * }
 */
export function trackNetworkError(
  error: unknown,
  endpoint: string,
  method: string,
  statusCode?: number,
  context?: Record<string, unknown>
): void {
  const errorObj = normalizeError(error);

  trackJSError({
    error_type: 'NetworkError',
    error_message: errorObj.message || `Failed to fetch ${endpoint}`,
    component: `${method} ${endpoint}`,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_action: `network_request_${method.toLowerCase()}`,
  });

  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[Network Error] ${method} ${endpoint}:`,
      {
        status: statusCode,
        error: errorObj.message,
        context,
      }
    );
  }
}

// ============================================================================
// Resource Loading Error Tracking
// ============================================================================

/**
 * Track image, script, or other resource loading errors
 * Use this in onError handlers for img, script, etc.
 *
 * Example:
 * <img src="/image.png" onError={(e) => trackResourceError(e, 'image', 'profile-avatar')} />
 */
export function trackResourceError(
  errorEvent: Event | Error,
  resourceType: string,
  resourceId?: string
): void {
  const errorMessage = errorEvent instanceof Error
    ? errorEvent.message
    : `Failed to load ${resourceType}${resourceId ? `: ${resourceId}` : ''}`;

  trackJSError({
    error_type: `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}LoadError`,
    error_message: errorMessage,
    component: resourceId || resourceType,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_action: `resource_load_${resourceType}`,
  });

  if (process.env.NODE_ENV === 'development') {
    console.error(`[Resource Error] ${resourceType}${resourceId ? ` (${resourceId})` : ''}:`, errorEvent);
  }
}

// ============================================================================
// Hook & State Management Error Tracking
// ============================================================================

/**
 * Track errors in custom hooks or state management
 * Use this in useEffect error handlers or hook implementations
 */
export function trackHookError(
  error: unknown,
  hookName: string,
  operation: string,
  context?: Record<string, unknown>
): void {
  const errorObj = normalizeError(error);

  trackJSError({
    error_type: 'HookError',
    error_message: errorObj.message,
    component: `${hookName}::${operation}`,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_action: `hook_error_${operation}`,
  });

  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[Hook Error] ${hookName} (${operation}):`,
      {
        error: errorObj.message,
        stack: errorObj.stack,
        context,
      }
    );
  }
}

// ============================================================================
// User Action Error Tracking
// ============================================================================

/**
 * Track errors triggered by user actions (clicks, form submissions, etc.)
 * Use this to correlate errors with specific user interactions
 */
export function trackUserActionError(
  error: unknown,
  action: string,
  component?: string,
  metadata?: Record<string, unknown>
): void {
  const errorObj = normalizeError(error);

  trackJSError({
    error_type: 'UserActionError',
    error_message: errorObj.message,
    component,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_action: action,
  });

  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[User Action Error] ${action}${component ? ` (${component})` : ''}:`,
      {
        error: errorObj.message,
        stack: errorObj.stack,
        metadata,
      }
    );
  }
}

// ============================================================================
// Validation & Data Error Tracking
// ============================================================================

/**
 * Track validation and data processing errors
 * Use this for form validation failures, data parsing errors, etc.
 */
export function trackValidationError(
  error: unknown,
  field?: string,
  context?: string,
  metadata?: Record<string, unknown>
): void {
  const errorObj = normalizeError(error);

  trackJSError({
    error_type: 'ValidationError',
    error_message: errorObj.message,
    component: field ? `validation_${field}` : 'validation',
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_action: `validate_${field || 'form'}`,
  });

  if (process.env.NODE_ENV === 'development') {
    console.error(
      `[Validation Error] ${field || 'Unknown field'}${context ? ` (${context})` : ''}:`,
      {
        error: errorObj.message,
        metadata,
      }
    );
  }
}

// ============================================================================
// Performance & Timeout Error Tracking
// ============================================================================

/**
 * Track timeout and performance-related errors
 * Use this for operations that exceed expected duration
 */
export function trackTimeoutError(
  operation: string,
  duration: number,
  component?: string
): void {
  trackJSError({
    error_type: 'TimeoutError',
    error_message: `Operation "${operation}" exceeded timeout after ${duration}ms`,
    component: component || operation,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    user_action: `timeout_${operation}`,
  });

  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[Timeout] ${operation}${component ? ` (${component})` : ''}: ${duration}ms`
    );
  }
}

// ============================================================================
// Global Error Handler Setup
// ============================================================================

/**
 * Initialize global error handlers for uncaught errors and unhandled promise rejections
 * Call this once in your app's root layout or initialization
 *
 * Example:
 * useEffect(() => {
 *   initGlobalErrorHandlers();
 * }, []);
 */
export function initGlobalErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', (event: ErrorEvent) => {
    trackJSError({
      error_type: 'UncaughtError',
      error_message: event.message || 'Unknown uncaught error',
      component: `${event.filename}:${event.lineno}:${event.colno}`,
      url: event.filename || (typeof window !== 'undefined' ? window.location.href : undefined),
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const errorObj = normalizeError(event.reason);
    trackJSError({
      error_type: 'UnhandledPromiseRejection',
      error_message: errorObj.message || 'Unhandled promise rejection',
      component: 'Promise',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize various error types to a standard Error object
 * Handles Error, string, object, and unknown types
 */
function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    return new Error(
      err.message ? String(err.message) : JSON.stringify(error)
    );
  }

  return new Error(String(error));
}

/**
 * Safely get error details without throwing
 */
export function getErrorDetails(error: unknown): {
  type: string;
  message: string;
  stack?: string;
} {
  const errorObj = normalizeError(error);
  return {
    type: errorObj.name || 'Error',
    message: errorObj.message,
    stack: errorObj.stack,
  };
}

/**
 * Create a safe error handler wrapper for async functions
 * Returns a handler that automatically tracks errors
 *
 * Example:
 * const handleSearch = createErrorHandler(
 *   async (query) => { return await fetchResults(query); },
 *   { operation: 'search', component: 'SearchPage' }
 * );
 */
export function createErrorHandler<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>,
  context: AsyncErrorContext
): (...args: T) => Promise<R | undefined> {
  return async (...args: T): Promise<R | undefined> => {
    try {
      return await handler(...args);
    } catch (error) {
      trackAsyncError(error, context);
      return undefined;
    }
  };
}

/**
 * Create a safe error boundary for synchronous operations
 *
 * Example:
 * const result = createSafeSync(
 *   () => JSON.parse(data),
 *   { operation: 'parse_json', component: 'DataProcessor' }
 * );
 */
export function createSafeSync<R>(
  handler: () => R,
  context: AsyncErrorContext
): R | undefined {
  try {
    return handler();
  } catch (error) {
    trackAsyncError(error, context);
    return undefined;
  }
}
