/**
 * PostHog Analytics Event Definitions
 *
 * Centralized event types and properties for consistent tracking across the application.
 * All events respect user consent and privacy settings.
 */

// ============================================================================
// Event Names
// ============================================================================

export const AnalyticsEvents = {
  // Authentication Events
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  AUTH_ERROR: 'auth_error',

  // Search Events
  SEARCH_PERFORMED: 'search_performed',
  SEARCH_RESULTS_LOADED: 'search_results_loaded',
  SEARCH_RESULT_CLICKED: 'search_result_clicked',
  SEARCH_REFINED: 'search_refined',
  SEARCH_TAB_CHANGED: 'search_tab_changed',
  SEARCH_EMPTY: 'search_empty',
  SEARCH_ERROR: 'search_error',

  // AI/Karakulak Events
  AI_QUERY_INITIATED: 'ai_query_initiated',
  AI_QUERY_COMPLETED: 'ai_query_completed',
  AI_QUERY_FAILED: 'ai_query_failed',
  AI_RESPONSE_VIEWED: 'ai_response_viewed',
  AI_TOGGLED: 'ai_toggled',
  AI_MODEL_CHANGED: 'ai_model_changed',
  AI_DIVE_TOGGLED: 'ai_dive_toggled',

  // Navigation Events
  PAGE_VIEW: '$pageview',
  PAGE_LEAVE: '$pageleave',

  // Settings Events
  SETTING_CHANGED: 'setting_changed',
  ANALYTICS_CONSENT_CHANGED: 'analytics_consent_changed',

  // Wikipedia Events
  WIKIPEDIA_VIEWED: 'wikipedia_viewed',
  WIKIPEDIA_EXPANDED: 'wikipedia_expanded',
  WIKIPEDIA_LINK_CLICKED: 'wikipedia_link_clicked',

  // Cluster Events
  NEWS_CLUSTER_VIEWED: 'news_cluster_viewed',
  NEWS_CLUSTER_EXPANDED: 'news_cluster_expanded',
  NEWS_ARTICLE_CLICKED: 'news_article_clicked',
  VIDEO_CLUSTER_VIEWED: 'video_cluster_viewed',
  VIDEO_CLUSTER_EXPANDED: 'video_cluster_expanded',
  VIDEO_CLICKED: 'video_clicked',

  // Feedback Events
  FEEDBACK_SUBMITTED: 'feedback_submitted',
  FEEDBACK_DISMISSED: 'feedback_dismissed',

  // Error Events
  JS_ERROR: 'js_error',
  API_ERROR: 'api_error',
} as const;

export type AnalyticsEventName = typeof AnalyticsEvents[keyof typeof AnalyticsEvents];

// ============================================================================
// Event Properties
// ============================================================================

export interface SearchEventProperties {
  search_type?: 'web' | 'images' | 'news' | 'videos';
  search_engine?: 'brave' | 'google' | 'you';
  query_length?: number;
  has_ai_enabled?: boolean;
  has_dive_enabled?: boolean;
  result_count?: number;
  response_time_ms?: number;
  error_type?: string;
}

export interface SearchResultClickedProperties {
  position: number;
  url?: string;
  search_type?: 'web' | 'images' | 'news' | 'videos';
  search_engine?: string;
}

export interface AIEventProperties {
  model: 'gemini' | 'llama' | 'mistral' | 'chatgpt' | 'grok' | 'claude' | 'dive';
  query_length?: number;
  response_length?: number;
  response_time_ms?: number;
  is_dive_mode?: boolean;
  sources_count?: number;
  error_type?: string;
  estimated_tokens?: number;
}

export interface AuthEventProperties {
  method?: 'email' | 'oauth';
  error_type?: string;
  has_existing_session?: boolean;
}

export interface WikipediaEventProperties {
  has_thumbnail?: boolean;
  language?: string;
  extract_length?: number;
}

export interface ClusterEventProperties {
  cluster_type?: 'news' | 'video';
  position?: 'inline' | 'bottom';
  article_count?: number;
}

export interface FeedbackEventProperties {
  rating?: number;
  category?: string;
  comment_length?: number;
}

export interface ErrorEventProperties {
  error_type: string;
  error_message?: string;
  component?: string;
  url?: string;
  user_action?: string;
}

// ============================================================================
// LLM Cost Estimation (approximate)
// ============================================================================

export const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  gemini: { input: 0.000001, output: 0.000001 }, // ~$1 per 1M tokens (flash-lite)
  llama: { input: 0.000001, output: 0.000001 }, // Llama 4 Maverick (estimated)
  mistral: { input: 0.000002, output: 0.000002 }, // Mistral Small 3.2 (estimated)
  chatgpt: { input: 0.000002, output: 0.000006 }, // GPT-5 mini (estimated)
  grok: { input: 0.000002, output: 0.000002 }, // Grok 4 Fast (estimated)
  claude: { input: 0.000001, output: 0.000005 }, // Haiku 4.5 (estimated)
  dive: { input: 0.000003, output: 0.000009 }, // Dive (higher due to RAG)
};

/**
 * Estimate token count from text (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate estimated cost for an AI request
 */
export function calculateCost(
  model: string,
  inputText: string,
  outputText: string
): number {
  const costs = TOKEN_COSTS[model] || TOKEN_COSTS.gemini;
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  return (inputTokens * costs.input) + (outputTokens * costs.output);
}

// ============================================================================
// Event Categories for Dashboards
// ============================================================================

export const EventCategories = {
  AUTHENTICATION: 'authentication',
  SEARCH: 'search',
  AI_ASSISTANT: 'ai_assistant',
  NAVIGATION: 'navigation',
  SETTINGS: 'settings',
  CONTENT: 'content',
  ERRORS: 'errors',
  FEEDBACK: 'feedback',
} as const;

/**
 * Get the category for a given event name
 */
export function getEventCategory(eventName: AnalyticsEventName): string {
  if (eventName.startsWith('user_') || eventName.startsWith('auth_')) {
    return EventCategories.AUTHENTICATION;
  }
  if (eventName.startsWith('search_') || eventName === 'search_performed') {
    return EventCategories.SEARCH;
  }
  if (eventName.startsWith('ai_') || eventName.includes('ai')) {
    return EventCategories.AI_ASSISTANT;
  }
  if (eventName.startsWith('$page')) {
    return EventCategories.NAVIGATION;
  }
  if (eventName.startsWith('setting_')) {
    return EventCategories.SETTINGS;
  }
  if (eventName.includes('wikipedia') || eventName.includes('cluster')) {
    return EventCategories.CONTENT;
  }
  if (eventName.includes('error') || eventName.includes('ERROR')) {
    return EventCategories.ERRORS;
  }
  if (eventName.includes('feedback')) {
    return EventCategories.FEEDBACK;
  }
  return 'other';
}
