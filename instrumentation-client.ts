import posthog from "posthog-js";
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

// ============================================================================
// Consent Management
// ============================================================================

const getAnalyticsConsent = (): boolean => {
  if (typeof window === 'undefined') return false;
  const consent = localStorage.getItem('analyticsEnabled');
  // Default to true if not explicitly set (opt-out model)
  return consent === null || consent === 'true';
};

const getSessionReplayConsent = (): boolean => {
  if (typeof window === 'undefined') return false;
  const consent = localStorage.getItem('sessionReplayEnabled');
  return consent === 'true';
};

// Track if analytics has been properly initialized with consent
let analyticsInitialized = false;

// ============================================================================
// PostHog Initialization
// ============================================================================

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: '/analytics',
  defaults: '2025-05-24',
  ui_host: 'https://eu.posthog.com',

  // Performance & Configuration
  debug: process.env.NODE_ENV === "development",

  // Privacy: Start disabled, enable only with consent
  opt_out_capturing_by_default: true,
  respect_dnt: true,

  // Session recording (disabled by default, enabled with consent)
  disable_session_recording: true,

  // We use minimal persistence - only for session continuity when consent is given
  disable_persistence: false,
  persistence: 'localStorage',
  disable_cookie: true,

  // Capture options - we control these dynamically based on consent
  capture_pageview: false, // We'll manage this dynamically
  capture_pageleave: false, // We'll manage this dynamically

  // Auto-capture
  autocapture: false, // Disable autocapture, we'll manually track

  // Error tracking
  capture_exceptions: false, // We'll handle this manually with consent check

  // Session replay
  session_recording: {
    maskTextSelector: '*', // Mask all text by default
    maskAllInputs: true, // Mask all inputs
  },

  // Advanced configuration
  before_send: (event) => {
    // Check consent before sending any event
    if (!getAnalyticsConsent() || !event) {
      return null;
    }

    // Add environment info to all events
    event.properties = {
      ...event.properties,
      environment: process.env.NODE_ENV || 'unknown',
    };

    return event;
  },

  // Rich analytics
  advanced_disable_decide: false,
});

// ============================================================================
// Web Vitals Tracking
// ============================================================================

interface MetricData {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
  delta: number;
  navigationType: string;
}

function getNavigationType(): string {
  if (typeof window === 'undefined' || !window.performance || !window.performance.navigation) {
    return 'unknown';
  }
  const navType = window.performance.navigation.type;
  switch (navType) {
    case 0: return 'navigate';
    case 1: return 'reload';
    case 2: return 'back_forward';
    default: return 'unknown';
  }
}

function trackWebVital(metric: MetricData) {
  if (!getAnalyticsConsent()) return;

  const ratingOrder = { good: 1, 'needs-improvement': 2, poor: 3 };
  const rating = ratingOrder[metric.rating as keyof typeof ratingOrder] || 2;

  posthog.capture('$web_vitals', {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    rating_order: rating,
    id: metric.id,
    delta: metric.delta,
    navigation_type: metric.navigationType,
    url: window.location.pathname,
  });
}

// Initialize Web Vitals tracking
function initWebVitals() {
  if (typeof window === 'undefined') return;

  const navType = getNavigationType();

  // Largest Contentful Paint (LCP) - measures loading performance
  onLCP((metric) => {
    trackWebVital({
      name: 'LCP',
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      delta: metric.delta,
      navigationType: navType,
    } as MetricData);
  });

  // Interaction to Next Paint (INP) - measures interactivity (replaces FID)
  onINP((metric) => {
    trackWebVital({
      name: 'INP',
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      delta: metric.delta,
      navigationType: navType,
    } as MetricData);
  });

  // Cumulative Layout Shift (CLS) - measures visual stability
  onCLS((metric) => {
    trackWebVital({
      name: 'CLS',
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      delta: metric.delta,
      navigationType: navType,
    } as MetricData);
  });

  // First Contentful Paint (FCP) - measures initial paint
  onFCP((metric) => {
    trackWebVital({
      name: 'FCP',
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      delta: metric.delta,
      navigationType: navType,
    } as MetricData);
  });

  // Time to First Byte (TTFB) - measures server response time
  onTTFB((metric) => {
    trackWebVital({
      name: 'TTFB',
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      delta: metric.delta,
      navigationType: navType,
    } as MetricData);
  });
}

// ============================================================================
// Scroll Depth Tracking
// ============================================================================

interface ScrollDepthConfig {
  maxDepth: number;
  depthIntervals: number[];
  trackedDepths: Set<number>;
}

const scrollConfig: ScrollDepthConfig = {
  maxDepth: 100,
  depthIntervals: [25, 50, 75, 90, 100],
  trackedDepths: new Set<number>(),
};

function trackScrollDepth(depth: number) {
  if (!getAnalyticsConsent()) return;
  if (scrollConfig.trackedDepths.has(depth)) return;

  scrollConfig.trackedDepths.add(depth);

  posthog.capture('$scrolldepth', {
    depth: depth,
    depth_percent: depth,
    max_depth: scrollConfig.maxDepth,
    url: window.location.pathname,
    scroll_height: document.documentElement.scrollHeight,
    scroll_client: document.documentElement.clientHeight,
  });
}

let lastScrollTop = 0;
let scrollTimeout: NodeJS.Timeout | null = null;

function handleScroll() {
  if (!getAnalyticsConsent()) return;

  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;

  // Calculate scroll percentage
  const scrollPercent = Math.min(
    100,
    Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
  );

  // Check each depth threshold
  scrollConfig.depthIntervals.forEach((depth) => {
    if (scrollPercent >= depth) {
      trackScrollDepth(depth);
    }
  });

  lastScrollTop = scrollTop;
}

function initScrollTracking() {
  if (typeof window === 'undefined') return;

  // Use throttled scroll listener
  window.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(handleScroll, 100);
  }, { passive: true });
}

// ============================================================================
// Page View & Leave Tracking
// ============================================================================

function trackPageView() {
  if (!getAnalyticsConsent()) return;

  posthog.capture('$pageview', {
    $current_url: window.location.href,
    $pathname: window.location.pathname,
    $search: window.location.search,
    $hash: window.location.hash,
    $referrer: document.referrer || undefined,
    title: document.title,
  });
}

function initPageTracking() {
  if (typeof window === 'undefined') return;

  // Track initial page view
  if (getAnalyticsConsent()) {
    trackPageView();
  }

  // Track page leave on visibility change (user switches tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && getAnalyticsConsent()) {
      posthog.capture('$pageleave', {
        $current_url: window.location.href,
        $pathname: window.location.pathname,
        engagement_time: Date.now() - (window as any).__pageLoadTime,
        max_scroll_depth: Math.max(...Array.from(scrollConfig.trackedDepths)),
      });
    }
  });

  // Track page leave on beforeunload
  window.addEventListener('beforeunload', () => {
    if (getAnalyticsConsent()) {
      posthog.capture('$pageleave', {
        $current_url: window.location.href,
        $pathname: window.location.pathname,
        engagement_time: Date.now() - (window as any).__pageLoadTime,
        max_scroll_depth: Math.max(...Array.from(scrollConfig.trackedDepths)),
      });
    }
  });

  // Store page load time
  (window as any).__pageLoadTime = Date.now();
}

// ============================================================================
// Consent Management & Initialization
// ============================================================================

/**
 * Enable or disable analytics based on user consent
 */
export function enableAnalytics(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem('analyticsEnabled', String(enabled));

  if (enabled) {
    posthog.opt_in_capturing();

    // Initialize tracking features if not already done
    if (!analyticsInitialized) {
      analyticsInitialized = true;
      initWebVitals();
      initScrollTracking();
      initPageTracking();
    }

    // Track current page view
    trackPageView();
  } else {
    posthog.opt_out_capturing();
    // Clear tracked depths
    scrollConfig.trackedDepths.clear();
  }
}

/**
 * Enable or disable session replay based on user consent
 */
export function enableSessionReplay(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem('sessionReplayEnabled', String(enabled));

  if (enabled && getAnalyticsConsent()) {
    posthog.startSessionRecording();
  } else {
    posthog.stopSessionRecording();
  }
}

/**
 * Check if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  return getAnalyticsConsent();
}

/**
 * Check if session replay is enabled
 */
export function isSessionReplayEnabled(): boolean {
  return getSessionReplayConsent();
}

// ============================================================================
// Track Route Changes (for Next.js App Router)
// ============================================================================

/**
 * Call this when route changes in Next.js App Router
 * Use in route change handlers or layout effects
 */
export function trackRouteChange(url: string) {
  if (!getAnalyticsConsent()) return;

  posthog.capture('$pageview', {
    $current_url: url,
    $pathname: new URL(url).pathname,
    title: document.title,
  });

  // Reset scroll tracking for new page
  scrollConfig.trackedDepths.clear();
}

// ============================================================================
// Initialize on load (if consent already given)
// ============================================================================

if (typeof window !== 'undefined') {
  // Check if user previously consented
  if (getAnalyticsConsent()) {
    analyticsInitialized = true;
    initWebVitals();
    initScrollTracking();
    initPageTracking();

    // Enable session replay if consented
    if (getSessionReplayConsent()) {
      posthog.startSessionRecording();
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export { posthog };
export default posthog;
