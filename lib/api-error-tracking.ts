/**
 * API Error Tracking Middleware
 *
 * This module provides utilities for tracking errors in API routes with PostHog.
 * It handles error capturing, logging, and response formatting with automatic PostHog integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { trackAPIError, flushServerEvents } from '@/lib/analytics-server';
import { getJWTUser } from '@/lib/jwt-auth';

/**
 * Configuration for API error tracking
 */
export interface APIErrorTrackingConfig {
  /** Name/path of the API endpoint (e.g., '/api/search') */
  endpoint: string;
  /** HTTP method (GET, POST, etc.) */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Whether to include error details in response (dev only) */
  includeErrorDetails?: boolean;
  /** Custom error handler for specific status codes */
  errorHandler?: (error: unknown, statusCode: number) => { message: string; details?: string };
}

/**
 * Wrapper function to track API errors and successes
 * Usage:
 * ```
 * export const GET = withErrorTracking(
 *   { endpoint: '/api/example', method: 'GET' },
 *   async (req) => {
 *     // Your handler logic here
 *   }
 * );
 * ```
 */
export function withErrorTracking<T extends NextRequest>(
  config: APIErrorTrackingConfig,
  handler: (req: T, ...args: any[]) => Promise<NextResponse | Response>
) {
  return async (req: T, ...args: any[]) => {
    const startTime = Date.now();

    try {
      const response = await handler(req, ...(args as any[]));

      // Track successful responses
      const responseTime = Date.now() - startTime;
      const status = response.status || 200;

      if (status >= 400) {
        // Track client/server errors
        const isAuthenticated = await isUserAuthenticated(req);
        trackAPIError({
          endpoint: config.endpoint,
          method: config.method,
          status_code: status,
          error_type: getErrorType(status),
          error_message: `HTTP ${status}`,
          user_authenticated: isAuthenticated,
        });
      }

      // Flush events asynchronously
      flushServerEvents().catch((err) => {
        console.warn('[PostHog] Failed to flush events:', err);
      });

      return response;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const isAuthenticated = await isUserAuthenticated(req);

      // Determine status code
      let statusCode = 500;
      let errorMessage = 'Internal Server Error';

      if (error instanceof Error) {
        errorMessage = error.message;
        // Try to extract status code from error
        if ('statusCode' in error && typeof error.statusCode === 'number') {
          statusCode = error.statusCode;
        }
      }

      // Track the error with PostHog
      trackAPIError({
        endpoint: config.endpoint,
        method: config.method,
        status_code: statusCode,
        error_type: error instanceof Error ? error.name : 'Unknown',
        error_message: errorMessage,
        user_authenticated: isAuthenticated,
      });

      // Flush events immediately for errors
      await flushServerEvents().catch((err) => {
        console.warn('[PostHog] Failed to flush error events:', err);
      });

      // Log error in development
      if (process.env.NODE_ENV === 'development') {
        console.error(`[API Error] ${config.endpoint} ${config.method}:`, error);
      }

      // Build error response
      const errorResponse = config.errorHandler
        ? config.errorHandler(error, statusCode)
        : getDefaultErrorResponse(statusCode, error);

      const responseBody: Record<string, any> = {
        error: errorResponse.message,
      };

      // Include error details in development
      if (config.includeErrorDetails && process.env.NODE_ENV === 'development') {
        if (errorResponse.details) {
          responseBody.details = errorResponse.details;
        }
      }

      return NextResponse.json(responseBody, { status: statusCode });
    }
  };
}

/**
 * Higher-order function to track specific error patterns
 * Use this to wrap handler functions that need error tracking without modifying the full handler
 */
export function trackErrors<T extends NextRequest>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
) {
  return function trackErrorsDecorator(
    handler: (req: T, ...args: any[]) => Promise<NextResponse | Response>
  ) {
    return withErrorTracking(
      { endpoint, method },
      handler
    );
  };
}

/**
 * Simple error tracking for inline try-catch blocks
 * Usage:
 * ```
 * try {
 *   // handler code
 * } catch (error) {
 *   return handleAPIError(error, req, '/api/endpoint', 'GET');
 * }
 * ```
 */
export async function handleAPIError(
  error: unknown,
  req: NextRequest,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  statusCode: number = 500
): Promise<NextResponse> {
  const isAuthenticated = await isUserAuthenticated(req);

  // Extract error message
  let errorMessage = 'Internal Server Error';
  let errorType = 'Unknown';

  if (error instanceof Error) {
    errorMessage = error.message;
    errorType = error.name;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // Track the error
  trackAPIError({
    endpoint,
    method,
    status_code: statusCode,
    error_type: errorType,
    error_message: errorMessage,
    user_authenticated: isAuthenticated,
  });

  // Flush events
  await flushServerEvents().catch((err) => {
    console.warn('[PostHog] Failed to flush error events:', err);
  });

  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[API Error] ${endpoint} ${method}:`, error);
  }

  return NextResponse.json(
    {
      error: getDefaultErrorResponse(statusCode, error).message,
      ...(process.env.NODE_ENV === 'development' && { details: errorMessage }),
    },
    { status: statusCode }
  );
}

/**
 * Get error type from HTTP status code
 */
function getErrorType(statusCode: number): string {
  if (statusCode === 400) return 'BadRequest';
  if (statusCode === 401) return 'Unauthorized';
  if (statusCode === 403) return 'Forbidden';
  if (statusCode === 404) return 'NotFound';
  if (statusCode === 429) return 'RateLimited';
  if (statusCode >= 500) return 'ServerError';
  return 'HTTPError';
}

/**
 * Get default error response message based on status code
 */
function getDefaultErrorResponse(
  statusCode: number,
  error: unknown
): { message: string; details?: string } {
  let message = 'An error occurred';
  let details = '';

  if (statusCode === 400) {
    message = 'Bad Request';
    details = 'The request was invalid';
  } else if (statusCode === 401) {
    message = 'Unauthorized';
    details = 'Authentication is required';
  } else if (statusCode === 403) {
    message = 'Forbidden';
    details = 'You do not have permission to access this resource';
  } else if (statusCode === 404) {
    message = 'Not Found';
    details = 'The requested resource was not found';
  } else if (statusCode === 429) {
    message = 'Too Many Requests';
    details = 'You have exceeded the rate limit. Please try again later.';
  } else if (statusCode >= 500) {
    message = 'Internal Server Error';
    if (error instanceof Error) {
      details = error.message;
    }
  }

  return { message, details: details || undefined };
}

/**
 * Check if the request is from an authenticated user
 */
async function isUserAuthenticated(req: NextRequest): Promise<boolean> {
  try {
    const user = await getJWTUser(req);
    return !!user;
  } catch {
    return false;
  }
}
