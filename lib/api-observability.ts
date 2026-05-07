import { NextRequest } from 'next/server';
import { logAPIRequest } from '@/lib/wide-event';
import { trackAPIError, flushServerEvents } from '@/lib/analytics-server';

type RouteContext = Record<string, unknown>;
type RouteHandler<TContext = RouteContext> = (
  request: NextRequest,
  context: TContext
) => Response | Promise<Response>;

function getRoutePath(request: NextRequest): string {
  try {
    return request.nextUrl.pathname;
  } catch {
    return new URL(request.url).pathname;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown route error';
}

function getErrorType(error: unknown): string {
  if (error instanceof Error) return error.name || 'Error';
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return String((error as { name?: unknown }).name || 'Error');
  }
  return 'Error';
}

/**
 * Baseline observability for every API route.
 *
 * Route-specific WideEvent/LLM/search logs can still add richer context; this
 * wrapper guarantees every API request emits a run log and thrown errors are
 * captured even when a route forgot its own logging.
 */
export function withAPIObservability<TContext = RouteContext>(
  handler: RouteHandler<TContext>
): RouteHandler<TContext> {
  return async (request: NextRequest, context: TContext) => {
    const startedAt = Date.now();
    const method = request.method;
    const path = getRoutePath(request);

    try {
      const response = await handler(request, context);
      const statusCode = response.status || 200;
      const durationMs = Date.now() - startedAt;

      logAPIRequest(method, path, statusCode, durationMs, {
        source: 'api_observability_wrapper',
      });

      if (statusCode >= 400) {
        trackAPIError({
          endpoint: path,
          method,
          status_code: statusCode,
          error_type: statusCode >= 500 ? 'ServerResponseError' : 'ClientResponseError',
          error_message: `HTTP ${statusCode}`,
        });
      }

      flushServerEvents().catch(() => undefined);
      return response;
    } catch (error) {
      const statusCode = 500;
      const durationMs = Date.now() - startedAt;
      const errorType = getErrorType(error);
      const errorMessage = getErrorMessage(error);

      logAPIRequest(method, path, statusCode, durationMs, {
        source: 'api_observability_wrapper',
        error: errorMessage,
        error_type: errorType,
      });

      trackAPIError({
        endpoint: path,
        method,
        status_code: statusCode,
        error_type: errorType,
        error_message: errorMessage,
      });

      flushServerEvents().catch(() => undefined);
      throw error;
    }
  };
}
