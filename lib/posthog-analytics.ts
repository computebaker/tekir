/**
 * PostHog Analytics - Privacy-First Consent-Aware Wrapper
 *
 * This module provides consent-aware wrapper functions for all PostHog operations.
 * No events are captured unless the user has explicitly opted in.
 */

import posthog from 'posthog-js';
import type {
  SearchEventProperties,
  SearchResultClickedProperties,
  AIEventProperties,
  AuthEventProperties,
  WikipediaEventProperties,
  ClusterEventProperties,
  FeedbackEventProperties,
  ErrorEventProperties,
} from './analytics-events';

// ============================================================================
// User Identity Management
// ============================================================================

/**
 * Get or generate a distinct ID for the user
 * Uses PostHog's internal distinct_id if available, otherwise generates a anonymous one
 */
function getDistinctId(): string {
  if (typeof window === 'undefined') return 'anonymous';

  // Try to get PostHog's distinct ID first
  const phDistinctId = posthog.get_distinct_id();
  if (phDistinctId && phDistinctId !== 'anonymous') {
    return phDistinctId;
  }

  // Check if we have a stored anonymous ID
  let anonymousId = localStorage.getItem('posthog_anonymous_id');
  if (!anonymousId) {
    anonymousId = `anon_${crypto.randomUUID()}`;
    localStorage.setItem('posthog_anonymous_id', anonymousId);
  }

  return anonymousId;
}

/**
 * Get the current user ID (for logged-in users)
 */
function getUserId(): string | null {
  if (typeof window === 'undefined') return null;

  // Check if we have a stored user ID from identification
  const userId = localStorage.getItem('posthog_user_id');
  return userId || null;
}

// ============================================================================
// Consent Management
// ============================================================================

/**
 * Check if analytics consent is granted
 * Defaults to true (opt-out) if not explicitly set
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false;
  const consent = localStorage.getItem('analyticsEnabled');
  // Default to true if not explicitly set (opt-out model)
  return consent === null || consent === 'true';
}

/**
 * Check if session replay consent is granted
 */
export function hasSessionReplayConsent(): boolean {
  if (typeof window === 'undefined') return false;
  const consent = localStorage.getItem('sessionReplayEnabled');
  return consent === 'true';
}

/**
 * Enable or disable analytics based on user consent
 * This should be called when the user changes their preference
 */
export function setAnalyticsConsent(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  const wasEnabled = hasAnalyticsConsent();
  localStorage.setItem('analyticsEnabled', String(enabled));

  if (enabled && !wasEnabled) {
    // User just opted in - enable tracking
    posthog.opt_in_capturing();

    // Register the anonymous ID with PostHog
    const distinctId = getDistinctId();
    posthog.identify(distinctId);

    captureEvent('analytics_enabled', { distinct_id: distinctId });
  } else if (!enabled && wasEnabled) {
    // User just opted out - disable tracking
    posthog.opt_out_capturing();
    // Don't clear the distinct_id - we want to remember the user if they opt back in
  }
}

/**
 * Enable or disable session replay based on user consent
 */
export function setSessionReplayConsent(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  const wasEnabled = hasSessionReplayConsent();
  localStorage.setItem('sessionReplayEnabled', String(enabled));

  if (enabled && !wasEnabled && hasAnalyticsConsent()) {
    posthog.startSessionRecording();
  } else if (!enabled && wasEnabled) {
    posthog.stopSessionRecording();
  }
}

// ============================================================================
// Event Tracking (Consent-Aware)
// ============================================================================

/**
 * Capture an analytics event
 * Only captures if user has consented to analytics
 */
function captureEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!hasAnalyticsConsent()) {
    return;
  }

  try {
    posthog.capture(eventName, {
      ...properties,
      distinct_id: getDistinctId(),
      user_id: getUserId(),
    });
  } catch (error) {
    console.error('[PostHog] Failed to capture event:', error);
  }
}

/**
 * Client-side log passthrough to PostHog (consent-aware)
 */
export function trackClientLog(
  message: string,
  properties?: Record<string, any>
): void {
  captureEvent('client_log', {
    message,
    ...properties,
  });
}

// ============================================================================
// Authentication Events
// ============================================================================

export function trackSignUp(method: 'email' | 'oauth' = 'email'): void {
  const distinctId = getDistinctId();

  // Identify the user right after signup
  posthog.identify(distinctId);
  posthog.people.set({
    signup_method: method,
    signup_date: new Date().toISOString(),
  });

  captureEvent('user_signed_up', { method });
}

export function trackSignIn(method?: string, hasExistingSession = false): void {
  captureEvent('user_signed_in', {
    method: method || 'unknown',
    has_existing_session: hasExistingSession,
  });
}

export function trackSignOut(): void {
  captureEvent('user_signed_out');

  // Reset user identity on sign out
  if (hasAnalyticsConsent()) {
    posthog.reset();

    // Clear stored user ID
    localStorage.removeItem('posthog_user_id');

    // Generate new anonymous ID for next session
    const newAnonymousId = `anon_${crypto.randomUUID()}`;
    localStorage.setItem('posthog_anonymous_id', newAnonymousId);
    posthog.identify(newAnonymousId);
  }
}

export function trackAuthError(errorType: string, errorMessage?: string): void {
  captureEvent('auth_error', {
    error_type: errorType,
    error_message: errorMessage,
  });
}

// ============================================================================
// Search Events
// ============================================================================

export function trackSearchPerformed(properties: SearchEventProperties): void {
  captureEvent('search_performed', {
    search_type: properties.search_type || 'web',
    search_engine: properties.search_engine,
    query_length: properties.query_length,
    has_ai_enabled: properties.has_ai_enabled,
    has_dive_enabled: properties.has_dive_enabled,
  });
}

export function trackSearchResultsLoaded(
  resultCount: number,
  responseTimeMs: number,
  searchType: 'web' | 'images' | 'news' | 'videos',
  engine: string
): void {
  captureEvent('search_results_loaded', {
    result_count: resultCount,
    response_time_ms: responseTimeMs,
    search_type: searchType,
    search_engine: engine,
  });
}

export function trackSearchResultClicked(properties: SearchResultClickedProperties): void {
  captureEvent('search_result_clicked', {
    position: properties.position,
    url: properties.url,
    search_type: properties.search_type,
    search_engine: properties.search_engine,
  });
}

export function trackSearchRefined(
  filterType: 'country' | 'safesearch' | 'language',
  previousValue: string,
  newValue: string
): void {
  captureEvent('search_refined', {
    filter_type: filterType,
    previous_value: previousValue,
    new_value: newValue,
  });
}

export function trackSearchTabChanged(
  fromTab: string,
  toTab: 'web' | 'images' | 'news' | 'videos'
): void {
  captureEvent('search_tab_changed', {
    from_tab: fromTab,
    to_tab: toTab,
  });
}

export function trackSearchEmpty(query: string): void {
  captureEvent('search_empty', {
    query_length: query.length,
  });
}

export function trackSearchError(errorType: string, searchType: string): void {
  captureEvent('search_error', {
    error_type: errorType,
    search_type: searchType,
  });
}

// ============================================================================
// AI/Karakulak Events
// ============================================================================

export function trackAIQueryInitiated(model: string, queryLength: number, isDiveMode = false): void {
  captureEvent('ai_query_initiated', {
    model,
    query_length: queryLength,
    is_dive_mode: isDiveMode,
  });
}

export function trackAIQueryCompleted(properties: AIEventProperties): void {
  captureEvent('ai_query_completed', {
    model: properties.model,
    query_length: properties.query_length,
    response_length: properties.response_length,
    response_time_ms: properties.response_time_ms,
    is_dive_mode: properties.is_dive_mode,
    sources_count: properties.sources_count,
    estimated_tokens: properties.estimated_tokens,
  });
}

export function trackAIQueryFailed(model: string, errorType: string, isDiveMode = false): void {
  captureEvent('ai_query_failed', {
    model,
    error_type: errorType,
    is_dive_mode: isDiveMode,
  });
}

export function trackAIResponseViewed(properties: AIEventProperties): void {
  captureEvent('ai_response_viewed', {
    model: properties.model,
    query_length: properties.query_length,
    response_length: properties.response_length,
    response_time_ms: properties.response_time_ms,
    is_dive_mode: properties.is_dive_mode,
    sources_count: properties.sources_count,
    estimated_tokens: properties.estimated_tokens,
  });
}

export function trackAIToggled(enabled: boolean): void {
  captureEvent('ai_toggled', { enabled });
}

export function trackAIModelChanged(previousModel: string, newModel: string): void {
  captureEvent('ai_model_changed', {
    previous_model: previousModel,
    new_model: newModel,
  });
}

export function trackAIDiveToggled(enabled: boolean): void {
  captureEvent('ai_dive_toggled', { enabled });
}

// ============================================================================
// Wikipedia Events
// ============================================================================

export function trackWikipediaViewed(properties: WikipediaEventProperties): void {
  captureEvent('wikipedia_viewed', {
    has_thumbnail: properties.has_thumbnail,
    language: properties.language,
    extract_length: properties.extract_length,
  });
}

export function trackWikipediaExpanded(hasThumbnail: boolean, extractLength: number): void {
  captureEvent('wikipedia_expanded', {
    has_thumbnail: hasThumbnail,
    extract_length: extractLength,
  });
}

export function trackWikipediaLinkClicked(): void {
  captureEvent('wikipedia_link_clicked');
}

// ============================================================================
// Cluster Events
// ============================================================================

export function trackNewsClusterViewed(articleCount: number, position: 'inline' | 'bottom'): void {
  captureEvent('news_cluster_viewed', {
    cluster_type: 'news',
    article_count: articleCount,
    position,
  });
}

export function trackNewsClusterExpanded(position: 'inline' | 'bottom'): void {
  captureEvent('news_cluster_expanded', {
    cluster_type: 'news',
    position,
  });
}

export function trackNewsArticleClicked(position: number, source?: string): void {
  captureEvent('news_article_clicked', {
    position,
    source,
  });
}

export function trackVideoClusterViewed(videoCount: number, position: 'inline' | 'bottom'): void {
  captureEvent('video_cluster_viewed', {
    cluster_type: 'video',
    article_count: videoCount,
    position,
  });
}

export function trackVideoClusterExpanded(position: 'inline' | 'bottom'): void {
  captureEvent('video_cluster_expanded', {
    cluster_type: 'video',
    position,
  });
}

export function trackVideoClicked(position: number, source?: string): void {
  captureEvent('video_clicked', {
    position,
    source,
  });
}

// ============================================================================
// Feedback Events
// ============================================================================

export function trackFeedbackSubmitted(properties: FeedbackEventProperties): void {
  captureEvent('feedback_submitted', {
    rating: properties.rating,
    category: properties.category,
    comment_length: properties.comment_length,
  });
}

export function trackFeedbackDismissed(reason?: string): void {
  captureEvent('feedback_dismissed', { reason });
}

// ============================================================================
// Settings Events
// ============================================================================

export function trackSettingChanged(settingKey: string, previousValue: any, newValue: any): void {
  captureEvent('setting_changed', {
    setting_key: settingKey,
    previous_value: String(previousValue),
    new_value: String(newValue),
  });
}

/**
 * Track analytics consent change
 * This event is captured regardless of consent (since it's about consent itself)
 */
export function trackAnalyticsConsentChanged(enabled: boolean): void {
  // This event bypasses consent check since it's about consent
  try {
    posthog.capture('analytics_consent_changed', {
      enabled,
      distinct_id: getDistinctId(),
    });
  } catch (error) {
    console.error('[PostHog] Failed to capture consent change:', error);
  }
}

// ============================================================================
// Error Events
// ============================================================================

export function trackJSError(properties: ErrorEventProperties): void {
  captureEvent('js_error', {
    error_type: properties.error_type,
    error_message: properties.error_message,
    component: properties.component,
    url: properties.url,
    user_action: properties.user_action,
  });
}

export function trackAntiAbuseEvent(
  action: string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  captureEvent('antiabuse_event', {
    action,
    ...properties,
  });
}

export function trackAPIError(
  errorType: string,
  url: string,
  statusCode?: number,
  userAction?: string
): void {
  captureEvent('api_error', {
    error_type: errorType,
    url: url.replace(/\/api\/[^\s]*/, '/api/**'), // Sanitize URL
    status_code: statusCode,
    user_action: userAction,
  });
}

// ============================================================================
// Page Views
// ============================================================================

/**
 * Track a page view
 * Call this when navigating to a new page
 */
export function trackPageView(url?: string, title?: string): void {
  if (!hasAnalyticsConsent()) return;

  const currentUrl = url || window.location.href;
  const currentTitle = title || document.title;

  try {
    posthog.capture('$pageview', {
      $current_url: currentUrl,
      $pathname: url ? new URL(url).pathname : window.location.pathname,
      title: currentTitle,
    });
  } catch (error) {
    console.error('[PostHog] Failed to capture pageview:', error);
  }
}

// ============================================================================
// User Identification
// ============================================================================

/**
 * Identify a user with a unique ID
 * Call this when a user signs in
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, any>
): void {
  if (!hasAnalyticsConsent()) return;

  try {
    // Store user ID for later retrieval
    localStorage.setItem('posthog_user_id', userId);

    posthog.identify(userId, {
      ...properties,
      user_id: userId,
    });

    // Also set people properties
    if (properties) {
      posthog.people.set(properties);
    }

    captureEvent('user_identified', { user_id: userId });
  } catch (error) {
    console.error('[PostHog] Failed to identify user:', error);
  }
}

/**
 * Set user properties for the currently identified user
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (!hasAnalyticsConsent()) return;

  try {
    posthog.people.set(properties);
  } catch (error) {
    console.error('[PostHog] Failed to set user properties:', error);
  }
}

// ============================================================================
// Session Recording
// ============================================================================

/**
 * Start session replay recording
 * Only works if user has consented to session replay
 */
export function startSessionReplay(): void {
  if (!hasAnalyticsConsent() || !hasSessionReplayConsent()) return;
  posthog.startSessionRecording();
}

/**
 * Stop session replay recording
 */
export function stopSessionReplay(): void {
  posthog.stopSessionRecording();
}

// ============================================================================
// Export convenience object
// ============================================================================

export const analytics = {
  // Consent
  hasConsent: hasAnalyticsConsent,
  hasSessionReplayConsent,
  setConsent: setAnalyticsConsent,
  setSessionReplayConsent,

  // Auth
  trackSignUp,
  trackSignIn,
  trackSignOut,
  trackAuthError,

  // Search
  trackSearchPerformed,
  trackSearchResultsLoaded,
  trackSearchResultClicked,
  trackSearchRefined,
  trackSearchTabChanged,
  trackSearchEmpty,
  trackSearchError,

  // AI
  trackAIQueryInitiated,
  trackAIQueryCompleted,
  trackAIQueryFailed,
  trackAIResponseViewed,
  trackAIToggled,
  trackAIModelChanged,
  trackAIDiveToggled,

  // Wikipedia
  trackWikipediaViewed,
  trackWikipediaExpanded,
  trackWikipediaLinkClicked,

  // Clusters
  trackNewsClusterViewed,
  trackNewsClusterExpanded,
  trackNewsArticleClicked,
  trackVideoClusterViewed,
  trackVideoClusterExpanded,
  trackVideoClicked,

  // Feedback
  trackFeedbackSubmitted,
  trackFeedbackDismissed,

  // Settings
  trackSettingChanged,
  trackAnalyticsConsentChanged,

  // Errors
  trackJSError,
  trackAntiAbuseEvent,
  trackAPIError,

  // Page
  trackPageView,

  // User
  identifyUser,
  setUserProperties,

  // Session
  startSessionReplay,
  stopSessionReplay,
};

export default analytics;
