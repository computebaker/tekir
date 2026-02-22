/**
 * PostHog Server-Side Analytics
 *
 * This module provides server-side PostHog analytics for API routes.
 * Server-side events are always captured (they don't depend on client consent)
 * but only include non-sensitive, aggregated data.
 */

import { PostHog } from 'posthog-node';

// Check if PostHog is configured
const POSTHOG_PROJECT_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let posthogClient: PostHog | null = null;

/**
 * Get or create the PostHog server client
 */
export function getPostHogClient(): PostHog | null {
  if (!POSTHOG_PROJECT_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(POSTHOG_PROJECT_KEY, {
      host: POSTHOG_HOST,
      flushAt: 20, // Batch events
      flushInterval: 10000, // Flush every 10 seconds
    });
  }

  return posthogClient;
}

/**
 * Server-side event tracking
 * Events are batched and flushed automatically
 */
export interface ServerEventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export function captureServerEvent(
  eventName: string,
  properties?: ServerEventProperties,
  distinctId?: string
): void {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  // Add server-side timestamp
  const enhancedProperties = {
    ...properties,
    server_event: true,
    environment: process.env.NODE_ENV || 'unknown',
  };

  client.capture({
    distinctId: distinctId || 'server',
    event: eventName,
    properties: enhancedProperties,
  });
}

/**
 * Generic server-side log passthrough to PostHog
 */
export function trackServerLog(
  message: string,
  properties?: ServerEventProperties,
  distinctId?: string
): void {
  captureServerEvent('server_log', {
    message,
    ...properties,
  }, distinctId);
}

/**
 * Flush pending events immediately
 * Use this for critical events or before process exit
 */
export async function flushServerEvents(): Promise<void> {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  await client.flush();
}

/**
 * Shutdown the PostHog client
 * Call this when shutting down the server
 */
export async function shutdownPostHog(): Promise<void> {
  const client = getPostHogClient();
  if (client) {
    await client.flush();
    posthogClient = null;
  }
}

// ============================================================================
// API Route Specific Events
// ============================================================================

export interface APIErrorEventProperties {
  endpoint: string;
  method: string;
  status_code?: number;
  error_type?: string;
  error_message?: string;
  user_authenticated?: boolean;
}

export function trackAPIError(properties: APIErrorEventProperties): void {
  captureServerEvent('api_error', {
    endpoint: sanitizeEndpoint(properties.endpoint),
    method: properties.method,
    status_code: properties.status_code,
    error_type: properties.error_type,
    error_message: properties.error_message,
    user_authenticated: properties.user_authenticated,
  });
}

export interface APISuccessEventProperties {
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms?: number;
  user_authenticated?: boolean;
}

export function trackAPISuccess(properties: APISuccessEventProperties): void {
  captureServerEvent('api_success', {
    endpoint: sanitizeEndpoint(properties.endpoint),
    method: properties.method,
    status_code: properties.status_code,
    response_time_ms: properties.response_time_ms,
    user_authenticated: properties.user_authenticated,
  });
}

export interface SearchEventProperties {
  search_type: 'web' | 'images' | 'news' | 'videos' | 'ai' | 'dive';
  provider: string;
  results_count?: number;
  response_time_ms?: number;
  user_authenticated?: boolean;
}

export function trackServerSearch(properties: SearchEventProperties): void {
  captureServerEvent('search_performed', {
    search_type: properties.search_type,
    provider: properties.provider,
    results_count: properties.results_count,
    response_time_ms: properties.response_time_ms,
    user_authenticated: properties.user_authenticated,
    source: 'server',
  });
}

export interface AIEventProperties {
  model: string;
  query_length?: number;
  response_length?: number;
  response_time_ms?: number;
  is_dive_mode?: boolean;
  sources_count?: number;
  estimated_cost_usd?: number;
  user_authenticated?: boolean;
}

export function trackServerAIQuery(properties: AIEventProperties): void {
  captureServerEvent('ai_query_completed', {
    model: properties.model,
    query_length: properties.query_length,
    response_length: properties.response_length,
    response_time_ms: properties.response_time_ms,
    is_dive_mode: properties.is_dive_mode,
    sources_count: properties.sources_count,
    estimated_cost_usd: properties.estimated_cost_usd,
    user_authenticated: properties.user_authenticated,
    source: 'server',
  });
}

export interface AIErrorEventProperties {
  model: string;
  error_type: string;
  is_dive_mode?: boolean;
  user_authenticated?: boolean;
}

export function trackServerAIError(properties: AIErrorEventProperties): void {
  captureServerEvent('ai_query_failed', {
    model: properties.model,
    error_type: properties.error_type,
    is_dive_mode: properties.is_dive_mode,
    user_authenticated: properties.user_authenticated,
    source: 'server',
  });
}

/**
 * Track LLM generation with native PostHog AI analytics
 * Uses the special $ai_generation event with $ai_ prefixed properties
 * for automatic LLM observability in PostHog
 */
export interface LLMServerEventProperties {
  $ai_provider: string;
  $ai_model: string;
  $ai_input: string;
  $ai_output: string;
  $ai_latency: number;
  $ai_tokens_input?: number;
  $ai_tokens_output?: number;
  $ai_tokens_total?: number;
  // Cost tracking (in USD) - PostHog native fields
  $ai_input_cost_usd?: number;
  $ai_output_cost_usd?: number;
  $ai_total_cost_usd?: number;
  $ai_trace_id?: string;
  $ai_temperature?: number;
  $ai_max_tokens?: number;
  user_id?: string;
  // User properties for context
  user_name?: string;
  user_email?: string;
  user_avatar?: string;
}

export function trackLLMGeneration(properties: LLMServerEventProperties): void {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  // Use user_id as distinct ID if available, otherwise fall back to 'server'
  const distinctId = properties.user_id || 'server';

  // Build person/user properties to set on the PostHog profile
  const userProperties: Record<string, any> = {};
  if (properties.user_id) {
    if (properties.user_name) {
      userProperties.name = properties.user_name;
    }
    if (properties.user_email) {
      userProperties.email = properties.user_email;
    }
    if (properties.user_avatar) {
      userProperties.avatar = properties.user_avatar;
    }
  }

  // Build event properties with user context
  const eventProperties: Record<string, any> = {
    $ai_provider: properties.$ai_provider,
    $ai_model: properties.$ai_model,
    // PostHog expects OpenAI-compatible message format for proper display
    $ai_input: [
      { role: 'user', content: properties.$ai_input }
    ],
    // Output choices - just the content strings
    $ai_output_choices: [properties.$ai_output],
    $ai_latency: properties.$ai_latency / 1000, // Convert ms to seconds for PostHog
    // Token counts
    $ai_input_tokens: properties.$ai_tokens_input,
    $ai_output_tokens: properties.$ai_tokens_output,
    // Cost in USD - PostHog uses these for LLM cost dashboards
    $ai_input_cost_usd: properties.$ai_input_cost_usd,
    $ai_output_cost_usd: properties.$ai_output_cost_usd,
    $ai_total_cost_usd: properties.$ai_total_cost_usd,
    $ai_trace_id: properties.$ai_trace_id,
    // Additional metadata
    temperature: properties.$ai_temperature,
    max_tokens: properties.$ai_max_tokens,
    server_event: true,
    environment: process.env.NODE_ENV || 'unknown',
  };

  // Set user properties on the PostHog profile if available
  if (Object.keys(userProperties).length > 0) {
    eventProperties.$set = userProperties;
  }

  client.capture({
    distinctId,
    event: '$ai_generation',
    properties: eventProperties,
  });
}

export interface AuthEventProperties {
  event_type: 'signup' | 'signin' | 'signout' | 'failed_signup' | 'failed_signin';
  method?: string;
  error_type?: string;
}

export function trackServerAuth(properties: AuthEventProperties): void {
  captureServerEvent(`auth_${properties.event_type}`, {
    method: properties.method,
    error_type: properties.error_type,
    source: 'server',
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sanitize endpoint path to remove sensitive parameters
 */
function sanitizeEndpoint(endpoint: string): string {
  // Remove user IDs, emails, and other sensitive parameters
  return endpoint
    .replace(/\/api\/user\/[^\/]+/g, '/api/user/**')
    .replace(/\/api\/auth\/[^\/]+/g, '/api/auth/**')
    .replace(/email=[^&]+/g, 'email=***')
    .replace(/username=[^&]+/g, 'username=***')
    .replace(/token=[^&]+/g, 'token=***')
    .replace(/password=[^&]+/g, 'password=***');
}

/**
 * Middleware helper to track API requests
 */
export function createAPITrackingMiddleware(
  endpoint: string,
  method: string
) {
  return {
    onSuccess: (responseTimeMs: number, statusCode: number, isAuthenticated: boolean) => {
      trackAPISuccess({
        endpoint,
        method,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        user_authenticated: isAuthenticated,
      });
    },
    onError: (error: Error, statusCode: number, isAuthenticated: boolean) => {
      trackAPIError({
        endpoint,
        method,
        status_code: statusCode,
        error_type: error.name || 'Error',
        error_message: error.message,
        user_authenticated: isAuthenticated,
      });
    },
  };
}
