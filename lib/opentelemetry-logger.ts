/**
 * OpenTelemetry Logger Utility
 *
 * Provides a convenient API for logging with OpenTelemetry.
 * Logs are sent to PostHog via OTLP HTTP.
 *
 * Usage:
 * ```ts
 * import { logger } from '@/lib/opentelemetry-logger';
 *
 * logger.info('User signed in', { userId: '123' });
 * logger.error('Database connection failed', { error: err.message });
 * logger.warn('Rate limit approaching', { requests: 95 });
 * ```
 */

import { logs } from '@opentelemetry/api-logs';
import type { Attributes } from '@opentelemetry/api';
import { trackServerLog } from '@/lib/analytics-server';

// Log severity levels
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Log attributes (any key-value pairs)
type LogAttributes = Record<string, string | number | boolean | null | undefined | unknown[] | Attributes>;

/**
 * OpenTelemetry Logger class
 */
class OpenTelemetryLogger {
  private logger;
  private isEnabled: boolean;

  constructor(name: string = 'tekir-app') {
    this.logger = logs.getLogger(name);
    this.isEnabled = process.env.NEXT_PUBLIC_POSTHOG_KEY !== undefined;
  }

  /**
   * Emit a log with the specified severity level
   */
  private log(level: LogLevel, body: string, attributes?: LogAttributes): void {
    if (!this.isEnabled) {
      // In development, still log to console if OpenTelemetry is disabled
      if (process.env.NODE_ENV === 'development') {
        trackServerLog('opentelemetry_disabled_log', {
          level,
          body,
          attributes_json: attributes ? JSON.stringify(attributes) : undefined,
        });
      }
      return;
    }

    try {
      this.logger.emit({
        severityText: level,
        body,
        attributes: (attributes || {}) as Attributes,
      });
    } catch (error) {
      // Fallback to console logging if OpenTelemetry fails
      console.error('[OpenTelemetry] Failed to emit log:', error);
      trackServerLog('opentelemetry_emit_failed', {
        level,
        body,
        attributes_json: attributes ? JSON.stringify(attributes) : undefined,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Log trace level message
   */
  trace(body: string, attributes?: LogAttributes): void {
    this.log('trace', body, attributes);
  }

  /**
   * Log debug level message
   */
  debug(body: string, attributes?: LogAttributes): void {
    this.log('debug', body, attributes);
  }

  /**
   * Log info level message
   */
  info(body: string, attributes?: LogAttributes): void {
    this.log('info', body, attributes);
  }

  /**
   * Log warning level message
   */
  warn(body: string, attributes?: LogAttributes): void {
    this.log('warn', body, attributes);
  }

  /**
   * Log error level message
   */
  error(body: string, attributes?: LogAttributes): void {
    this.log('error', body, attributes);
  }

  /**
   * Log fatal level message
   */
  fatal(body: string, attributes?: LogAttributes): void {
    this.log('fatal', body, attributes);
  }

  /**
   * Log HTTP request
   */
  httpRequest(method: string, url: string, statusCode?: number, durationMs?: number, attributes?: LogAttributes): void {
    this.info('HTTP Request', {
      http_method: method,
      url: this.sanitizeUrl(url),
      status_code: statusCode,
      duration_ms: durationMs,
      ...attributes,
    });
  }

  /**
   * Log HTTP error
   */
  httpError(method: string, url: string, statusCode: number, errorMessage?: string, attributes?: LogAttributes): void {
    this.error('HTTP Request Failed', {
      http_method: method,
      url: this.sanitizeUrl(url),
      status_code: statusCode,
      error_message: errorMessage,
      ...attributes,
    });
  }

  /**
   * Log database operation
   */
  dbOperation(operation: string, table: string, durationMs?: number, attributes?: LogAttributes): void {
    this.info('Database Operation', {
      db_operation: operation,
      db_table: table,
      duration_ms: durationMs,
      ...attributes,
    });
  }

  /**
   * Log database error
   */
  dbError(operation: string, table: string, errorMessage: string, attributes?: LogAttributes): void {
    this.error('Database Operation Failed', {
      db_operation: operation,
      db_table: table,
      error_message: errorMessage,
      ...attributes,
    });
  }

  /**
   * Log API route execution
   */
  apiRoute(route: string, method: string, statusCode: number, durationMs: number, attributes?: LogAttributes): void {
    this.info('API Route', {
      api_route: route,
      method,
      status_code: statusCode,
      duration_ms: durationMs,
      ...attributes,
    });
  }

  /**
   * Log authentication event
   */
  authEvent(event: string, userId?: string, attributes?: LogAttributes): void {
    this.info(`Authentication: ${event}`, {
      auth_event: event,
      user_id: userId,
      ...attributes,
    });
  }

  /**
   * Log AI query
   */
  aiQuery(model: string, queryLength: number, responseLength: number, durationMs: number, attributes?: LogAttributes): void {
    this.info('AI Query', {
      ai_model: model,
      query_length: queryLength,
      response_length: responseLength,
      duration_ms: durationMs,
      ...attributes,
    });
  }

  /**
   * Log search operation
   */
  search(searchType: string, provider: string, resultCount: number, durationMs: number, attributes?: LogAttributes): void {
    this.info('Search', {
      search_type: searchType,
      provider,
      result_count: resultCount,
      duration_ms: durationMs,
      ...attributes,
    });
  }

  /**
   * Sanitize URL to remove sensitive information
   */
  private sanitizeUrl(url: string): string {
    // Remove query parameters that might contain sensitive data
    try {
      const parsed = new URL(url);
      // Keep only safe query params
      const safeParams = ['q', 'query', 'type', 'provider', 'page', 'limit'];
      const params = new URLSearchParams();
      Array.from(parsed.searchParams.entries()).forEach(([key, value]) => {
        if (safeParams.includes(key)) {
          params.append(key, value);
        }
      });
      parsed.search = params.toString();
      return parsed.toString();
    } catch {
      // If URL parsing fails, return a sanitized version
      return url.replace(/token=[^&]+/gi, 'token=REDACTED')
        .replace(/session=[^&]+/gi, 'session=REDACTED')
        .replace(/password=[^&]+/gi, 'password=REDACTED');
    }
  }
}

// Export singleton instance
export const logger = new OpenTelemetryLogger();

// Also export the class for custom instances
export { OpenTelemetryLogger };
