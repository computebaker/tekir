/**
 * Wide Event / Canonical Log Line System
 *
 * Based on the philosophy that each request should generate ONE comprehensive log event
 * with all context attached, rather than multiple scattered log lines.
 *
 * Key concepts:
 * - High cardinality: user_id, session_id, request_id, trace_id
 * - High dimensionality: 50+ fields per event
 * - Business context: subscription tier, cart value, feature flags
 * - Structured: JSON format, queryable
 *
 * Usage:
 * ```ts
 * import { createWideEvent, WideEventMiddleware } from '@/lib/wide-event';
 *
 * // In API routes
 * export const GET = WideEventMiddleware(async (req, ctx) => {
 *   const event = ctx.wideEvent;
 *   event.setUser(user);
 *   event.setCart(cart);
 *   // ... business logic
 *   // Event is automatically emitted at the end
 * });
 * ```
 */

import { logs } from '@opentelemetry/api-logs';
import type { Attributes } from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import { trackServerLog } from '@/lib/analytics-server';

// ============================================================================
// Types
// ============================================================================

export interface UserContext {
  id: string;
  email?: string;
  username?: string;
  subscription?: 'free' | 'plus' | 'pro' | 'enterprise';
  account_age_days?: number;
  lifetime_value_cents?: number;
  is_internal?: boolean;
  is_vip?: boolean;
}

export interface RequestContext {
  id: string;
  trace_id: string;
  method: string;
  path: string;
  query_params?: Record<string, string>;
  user_agent?: string;
  ip_address?: string;
  referer?: string;
}

export interface ResponseContext {
  status_code: number;
  duration_ms: number;
  response_size_bytes?: number;
}

export interface ErrorContext {
  type: string;
  code?: string;
  message: string;
  stack_trace?: string;
  retriable?: boolean;
  domain?: string; // e.g., 'database', 'upstream_api', 'validation'
}

export interface SearchContext {
  query?: string; // Sanitized, no PII
  query_length?: number;
  search_type?: 'web' | 'images' | 'news' | 'videos' | 'ai' | 'dive';
  provider?: string;
  results_count?: number;
  has_ai_enabled?: boolean;
  filters_used?: string[];
  tab_used?: string;
}

export interface AIContext {
  model?: string;
  query_length?: number;
  response_length?: number;
  estimated_tokens?: number;
  estimated_cost_cents?: number;
  is_dive_mode?: boolean;
  providers_used?: string[];
  sources_count?: number;
}

export interface AuthContext {
  method?: 'email' | 'username' | 'oauth' | 'session';
  action?: 'signup' | 'signin' | 'signout' | 'verify' | 'refresh';
  success?: boolean;
  failure_reason?: string;
  session_duration_seconds?: number;
  mfa_enabled?: boolean;
}

export interface DatabaseContext {
  operation?: string;
  table?: string;
  latency_ms?: number;
  rows_affected?: number;
  cache_hit?: boolean;
}

export interface FeatureFlags {
  [key: string]: boolean | string | number;
}

export interface WideEventData {
  // Request metadata
  request_id: string;
  trace_id: string;
  parent_span_id?: string;
  timestamp: string;
  environment: string;

  // Service metadata
  service_name: string;
  service_version: string;
  deployment_id?: string;
  region?: string;

  // Request data
  http_method: string;
  http_path: string;
  http_route?: string;
  http_status_code: number;
  http_duration_ms: number;

  // User context (high cardinality!)
  user?: {
    id?: string;
    subscription?: string;
    account_age_days?: number;
    lifetime_value_cents?: number;
    is_internal?: boolean;
    is_vip?: boolean;
  };

  // Session context
  session?: {
    id?: string;
    new?: boolean;
    duration_seconds?: number;
  };

  // Business context
  search?: SearchContext;
  ai?: AIContext;
  auth?: AuthContext;
  database?: DatabaseContext;

  // Feature flags
  feature_flags?: FeatureFlags;

  // Error context
  error?: {
    type?: string;
    code?: string;
    message?: string;
    domain?: string;
    retriable?: boolean;
  };

  // Outcome
  outcome: 'success' | 'error' | 'partial';

  // Custom attributes for extensibility
  custom?: Record<string, string | number | boolean | null>;
}

// ============================================================================
// Wide Event Class
// ============================================================================

export class WideEvent {
  private data: Partial<WideEventData>;
  private startTime: number;
  private logger = logs.getLogger('tekir-wide-events');
  private static instance: WideEvent | null = null;

  private constructor() {
    this.startTime = Date.now();
    this.data = {
      request_id: randomUUID(),
      trace_id: this.getTraceId(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      service_name: 'tekir-nextjs',
      service_version: process.env.npm_package_version || '1.0.0',
      deployment_id: process.env.VERCEL_DEPLOYMENT_ID || process.env.HEROKU_RELEASE_VERSION || 'local',
      region: process.env.VERCEL_REGION || process.env.HEROKU_REGION || 'unknown',
    };
  }

  private getTraceId(): string {
    // Try to get existing trace ID from OpenTelemetry or generate new one
    if (typeof process !== 'undefined' && process.env?.OTEL_TRACE_PARENT) {
      const match = process.env.OTEL_TRACE_PARENT.match(/^([0-9a-f]{32})/);
      if (match) return match[1];
    }
    return randomUUID();
  }

  /**
   * Get or create the current wide event for this request
   */
  static getOrCreate(): WideEvent {
    if (WideEvent.instance) {
      return WideEvent.instance;
    }
    WideEvent.instance = new WideEvent();
    return WideEvent.instance;
  }

  /**
   * Reset the wide event (for new requests)
   */
  static reset(): void {
    WideEvent.instance = null;
  }

  /**
   * Set request context
   */
  setRequest(req: {
    method: string;
    path: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
  }): this {
    this.data.http_method = req.method;
    this.data.http_path = req.path;
    // Extract route template by parameterizing path
    this.data.http_route = this.parameterizePath(req.path);
    return this;
  }

  /**
   * Convert path like /api/user/abc123 to /api/user/:id
   */
  private parameterizePath(path: string): string {
    return path
      .replace(/\/api\/karakulak\/[^\/]+/g, '/api/karakulak/:model')
      .replace(/\/api\/pars\/[^\/]+/g, '/api/pars/:provider')
      .replace(/\/api\/images\/[^\/]+/g, '/api/images/:provider')
      .replace(/\/api\/news\/[^\/]+/g, '/api/news/:provider')
      .replace(/\/api\/videos\/[^\/]+/g, '/api/videos/:provider')
      .replace(/\/api\/autocomplete\/[^\/]+/g, '/api/autocomplete/:provider')
      .replace(/\/api\/user\/[^\/]+/g, '/api/user/:action')
      .replace(/\/api\/[a-f0-9]{24}/g, '/api/:id');
  }

  /**
   * Set user context
   */
  setUser(user: Partial<UserContext>): this {
    if (!this.data.user) {
      this.data.user = {};
    }
    if (user.id) this.data.user.id = this.maskId(user.id);
    if (user.email) this.data.user.id = this.data.user.id || this.maskEmail(user.email);
    if (user.username) this.data.user.id = this.data.user.id || user.username;
    if (user.subscription) this.data.user.subscription = user.subscription;
    if (user.account_age_days) this.data.user.account_age_days = user.account_age_days;
    if (user.lifetime_value_cents) this.data.user.lifetime_value_cents = user.lifetime_value_cents;
    if (user.is_internal !== undefined) this.data.user.is_internal = user.is_internal;
    if (user.is_vip !== undefined) this.data.user.is_vip = user.is_vip;
    return this;
  }

  /**
   * Set session context
   */
  setSession(session: { id?: string; new?: boolean; duration_seconds?: number }): this {
    this.data.session = {
      id: session.id ? this.maskId(session.id) : undefined,
      new: session.new,
      duration_seconds: session.duration_seconds,
    };
    return this;
  }

  /**
   * Set search context
   */
  setSearch(search: SearchContext): this {
    this.data.search = {
      query_length: search.query?.length || 0,
      search_type: search.search_type,
      provider: search.provider,
      results_count: search.results_count,
      has_ai_enabled: search.has_ai_enabled,
      filters_used: search.filters_used,
      tab_used: search.tab_used,
    };
    // Never log the actual query (PII)
    return this;
  }

  /**
   * Set AI context
   */
  setAI(ai: AIContext): this {
    this.data.ai = ai;
    return this;
  }

  /**
   * Set auth context
   */
  setAuth(auth: AuthContext): this {
    this.data.auth = auth;
    return this;
  }

  /**
   * Set database context
   */
  setDatabase(db: DatabaseContext): this {
    this.data.database = db;
    return this;
  }

  /**
   * Set feature flags
   */
  setFeatureFlags(flags: FeatureFlags): this {
    this.data.feature_flags = flags;
    return this;
  }

  /**
   * Set error context
   */
  setError(error: Error | ErrorContext | string): this {
    if (typeof error === 'string') {
      this.data.error = { type: 'Error', message: error };
    } else if (error instanceof Error) {
      this.data.error = {
        type: error.name,
        message: error.message,
        stack_trace: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      } as ErrorContext;
    } else {
      this.data.error = error;
    }
    return this;
  }

  /**
   * Set custom attributes
   */
  setCustom(key: string, value: string | number | boolean | null): this {
    if (!this.data.custom) {
      this.data.custom = {};
    }
    this.data.custom[key] = value;
    return this;
  }

  /**
   * Set response context (status code and duration)
   */
  setResponse(statusCode: number, durationMs?: number): this {
    this.data.http_status_code = statusCode;
    this.data.http_duration_ms = durationMs ?? (Date.now() - this.startTime);
    this.data.outcome = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'partial' : 'success';
    return this;
  }

  /**
   * Set the final status code and emit the event
   */
  finish(statusCode: number = 200): void {
    this.data.http_status_code = statusCode;
    this.data.http_duration_ms = Date.now() - this.startTime;
    this.data.outcome = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'partial' : 'success';

    // Apply tail sampling
    if (!this.shouldSample()) {
      return; // Skip logging for sampled-out events
    }

    this.emitNow();
  }

  /**
   * Tail sampling: decide whether to keep this event
   */
  private shouldSample(): boolean {
    const { http_status_code, user, error } = this.data;

    // Always keep errors
    if (http_status_code && http_status_code >= 500) return true;
    if (error) return true;

    // Always keep slow requests (above 2 seconds)
    if (this.data.http_duration_ms && this.data.http_duration_ms > 2000) return true;

    // Always keep VIP users
    if (user?.is_vip) return true;

    // Always keep internal users
    if (user?.is_internal) return true;

    // Random sample 5% of successful/fast requests
    return Math.random() < 0.05;
  }

  /**
   * Emit the wide event to OpenTelemetry immediately (bypasses sampling)
   * This is a public method for helper functions that need immediate emission
   */
  emitNow(): void {
    try {
      this.logger.emit({
        severityText: this.data.outcome === 'error' ? 'error' : this.data.outcome === 'partial' ? 'warn' : 'info',
        body: `${this.data.http_method} ${this.data.http_path} - ${this.data.outcome}`,
        attributes: this.data as Attributes,
      });
    } catch (err) {
      // Fallback to console if OpenTelemetry fails
      console.error('[WideEvent] Failed to emit:', err);
      if (process.env.NODE_ENV === 'development') {
        trackServerLog('wide_event_emit_failed', {
          data_json: JSON.stringify(this.data),
          error_message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Mask a sensitive ID for logging
   */
  private maskId(id: string): string {
    if (id.length <= 8) return '***';
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  }

  /**
   * Mask email for logging
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***';
    return `${local.slice(0, 2)}***@${domain}`;
  }

  /**
   * Get current event data (for debugging)
   */
  getData(): Partial<WideEventData> {
    return { ...this.data };
  }
}

// ============================================================================
// Middleware Factory
// ============================================================================

export type WideEventContext = {
  wideEvent: WideEvent;
};

/**
 * Helper to extract user from request
 */
async function getUserFromRequest(req: Request): Promise<UserContext | null> {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const hasSession = cookieHeader.includes('session-token=');

    if (!hasSession) {
      return null;
    }

    // Try to get user ID from session
    // This would typically call your session validation
    // For now, return null - let individual routes set user context
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a wide event for the current request
 */
export function createWideEvent(): WideEvent {
  return WideEvent.getOrCreate();
}

/**
 * Get the current wide event (returns null if none exists)
 */
export function getWideEvent(): WideEvent | null {
  return WideEvent.getOrCreate();
}

/**
 * Reset the wide event (call between requests)
 */
export function resetWideEvent(): void {
  WideEvent.reset();
}

// ============================================================================
// Convenience Functions for Common Operations
// ============================================================================

/**
 * Log an API request with proper context
 */
export function logAPIRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context?: {
    userId?: string;
    subscription?: string;
    error?: string;
    [key: string]: any;
  }
): void {
  resetWideEvent();
  const event = WideEvent.getOrCreate();

  event.setRequest({ method, path });
  event.setResponse(statusCode, durationMs);

  if (context?.userId) {
    event.setUser({ id: context.userId, subscription: context.subscription as any });
  }

  if (context?.error) {
    event.setError(context.error);
  }

  // Add custom context
  Object.entries(context || {}).forEach(([key, value]) => {
    if (key !== 'userId' && key !== 'subscription' && key !== 'error') {
      event.setCustom(key, value);
    }
  });

  // Emit immediately
  event.emitNow();
}

/**
 * Log a search operation
 */
export function logSearch(context: {
  query?: string;
  search_type: 'web' | 'images' | 'news' | 'videos' | 'ai' | 'dive';
  provider?: string;
  results_count?: number;
  duration_ms: number;
  status_code: number;
  userId?: string;
  error?: string;
}): void {
  resetWideEvent();
  const event = WideEvent.getOrCreate();

  event.setRequest({ method: 'GET', path: `/search/${context.search_type}` });
  event.setResponse(context.status_code, context.duration_ms);
  event.setSearch({
    search_type: context.search_type,
    provider: context.provider,
    results_count: context.results_count,
    query_length: context.query?.length,
  });

  if (context.userId) {
    event.setUser({ id: context.userId });
  }

  if (context.error) {
    event.setError(context.error);
  }

  event.emitNow();
}

/**
 * Log an AI query
 */
export function logAIQuery(context: {
  model: string;
  query_length: number;
  response_length?: number;
  estimated_tokens?: number;
  estimated_cost_cents?: number;
  duration_ms: number;
  status_code: number;
  userId?: string;
  error?: string;
  is_dive_mode?: boolean;
}): void {
  resetWideEvent();
  const event = WideEvent.getOrCreate();

  event.setRequest({ method: 'POST', path: '/api/karakulak/:model' });
  event.setResponse(context.status_code, context.duration_ms);
  event.setAI({
    model: context.model,
    query_length: context.query_length,
    response_length: context.response_length,
    estimated_tokens: context.estimated_tokens,
    estimated_cost_cents: context.estimated_cost_cents,
    is_dive_mode: context.is_dive_mode,
  });

  if (context.userId) {
    event.setUser({ id: context.userId });
  }

  if (context.error) {
    event.setError(context.error);
  }

  event.emitNow();
}

/**
 * Log an auth event
 */
export function logAuth(context: {
  action: 'signup' | 'signin' | 'signout' | 'verify' | 'refresh';
  method?: 'email' | 'username' | 'oauth' | 'session';
  success: boolean;
  userId?: string;
  failure_reason?: string;
  duration_ms?: number;
}): void {
  resetWideEvent();
  const event = WideEvent.getOrCreate();

  event.setRequest({ method: 'POST', path: `/api/auth/${context.action}` });
  event.setAuth({
    action: context.action,
    method: context.method,
    success: context.success,
    failure_reason: context.failure_reason,
  });

  // Set outcome based on success
  if (context.success) {
    event.setResponse(200, context.duration_ms);
  } else {
    event.setResponse(401, context.duration_ms);
  }

  if (context.userId) {
    event.setUser({ id: context.userId });
  }

  event.emitNow();
}

// ============================================================================
// Export singleton getter
// ============================================================================

export default WideEvent;
