/**
 * Client-side utilities for anti-abuse CAPTCHA system
 * Handles challenge requests, resource loading tracking, and verification
 */

import { trackAntiAbuseEvent, trackJSError } from '@/lib/posthog-analytics';

export interface ChallengeRequest {
  required: boolean;
  sessionId: string;
  severity?: 'low' | 'medium' | 'high';
  reason?: string;
  payload?: {
    id: string;
    timestamp: number;
    requiredResources: {
      js: string;
      css: string;
    };
  };
  resources?: {
    js: string;
    css: string;
  };
}

export interface ResourceLoadEvent {
  sessionId: string;
  resourcePath: string;
  type: 'js' | 'css';
}

/**
 * Request a challenge from the server based on browser characteristics
 */
export async function requestChallenge(): Promise<ChallengeRequest> {
  try {
    const response = await fetch('/api/captcha/challenge-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Challenge request failed: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    trackJSError({
      error_type: 'AntiAbuseChallengeRequestError',
      error_message: error instanceof Error ? error.message : String(error),
      component: 'captcha-client',
      user_action: 'request_challenge',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    throw error;
  }
}

/**
 * Track that a resource (JS/CSS) has been loaded
 */
export async function trackResourceLoad(
  sessionId: string,
  resourcePath: string,
  type: 'js' | 'css'
): Promise<void> {
  try {
    const response = await fetch('/api/captcha/resource-loaded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        sessionId,
        resourcePath,
        type,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resource tracking failed: ${response.statusText}`);
    }

    trackAntiAbuseEvent('resource_tracked', {
      type,
      resource_path: resourcePath,
      session_id: sessionId,
    });
  } catch (error) {
    trackJSError({
      error_type: 'AntiAbuseResourceTrackingError',
      error_message: error instanceof Error ? error.message : String(error),
      component: 'captcha-client',
      user_action: 'track_resource_load',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    throw error;
  }
}

/**
 * Load a script dynamically and track it
 */
export async function loadScriptWithTracking(
  src: string,
  sessionId: string,
  attributes?: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.type = 'module';

    // Apply any additional attributes
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        script.setAttribute(key, value);
      });
    }

    script.onload = async () => {
      try {
        await trackResourceLoad(sessionId, src, 'js');
        resolve();
      } catch (error) {
        trackJSError({
          error_type: 'AntiAbuseScriptTrackError',
          error_message: error instanceof Error ? error.message : String(error),
          component: 'captcha-client',
          user_action: 'track_script_load',
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        });
        reject(error);
      }
    };

    script.onerror = () => {
      reject(new Error(`Failed to load script: ${src}`));
    };

    document.head.appendChild(script);
  });
}

/**
 * Load a stylesheet dynamically and track it
 */
export async function loadStylesheetWithTracking(
  href: string,
  sessionId: string,
  attributes?: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;

    // Apply any additional attributes
    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        link.setAttribute(key, value);
      });
    }

    link.onload = async () => {
      try {
        await trackResourceLoad(sessionId, href, 'css');
        resolve();
      } catch (error) {
        trackJSError({
          error_type: 'AntiAbuseStylesheetTrackError',
          error_message: error instanceof Error ? error.message : String(error),
          component: 'captcha-client',
          user_action: 'track_stylesheet_load',
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        });
        reject(error);
      }
    };

    link.onerror = () => {
      reject(new Error(`Failed to load stylesheet: ${href}`));
    };

    document.head.appendChild(link);
  });
}

/**
 * Verify that required resources were loaded
 */
export async function verifyResourcesLoaded(
  sessionId: string,
  expectedResources?: { js: string; css: string }
): Promise<{
  passed: boolean;
  reason: string;
  riskScore?: number;
  requiresCaptcha?: boolean;
}> {
  try {
    const response = await fetch('/api/captcha/verify-resources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        sessionId,
        expectedResources,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        passed: false,
        reason: errorData.reason ?? 'Resource verification failed',
      };
    }

    return response.json();
  } catch (error) {
    trackJSError({
      error_type: 'AntiAbuseResourceVerificationError',
      error_message: error instanceof Error ? error.message : String(error),
      component: 'captcha-client',
      user_action: 'verify_resources',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    return {
      passed: false,
      reason: 'Failed to verify resources',
    };
  }
}

/**
 * Execute anti-abuse challenge flow
 * Returns true if user passes, false if blocked
 */
export async function executeAntiAbuseChallengeFlow(): Promise<{
  passed: boolean;
  sessionId: string;
  message: string;
}> {
  try {
    // Step 1: Request challenge
    trackAntiAbuseEvent('challenge_flow_start');
    const challenge = await requestChallenge();
    const { sessionId, required, resources } = challenge;

    trackAntiAbuseEvent('challenge_required_check', {
      required,
      session_id: sessionId,
    });

    // If challenge not required, we're good
    if (!required) {
      return {
        passed: true,
        sessionId,
        message: 'No challenge required',
      };
    }

    // Step 2: Load required resources
    if (resources?.js && resources?.css) {
      trackAntiAbuseEvent('resource_load_start', {
        session_id: sessionId,
      });
      try {
        await Promise.all([
          loadScriptWithTracking(resources.js, sessionId),
          loadStylesheetWithTracking(resources.css, sessionId),
        ]);
        trackAntiAbuseEvent('resource_load_success', {
          session_id: sessionId,
        });
      } catch (error) {
        trackJSError({
          error_type: 'AntiAbuseResourceLoadError',
          error_message: error instanceof Error ? error.message : String(error),
          component: 'captcha-client',
          user_action: 'load_resources',
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        });
        return {
          passed: false,
          sessionId,
          message: 'Failed to load challenge resources',
        };
      }

      // Step 3: Verify resources were loaded
      const verification = await verifyResourcesLoaded(sessionId, resources);
      if (!verification.passed) {
        trackAntiAbuseEvent('resource_verification_failed', {
          session_id: sessionId,
          reason: verification.reason,
        });
        return {
          passed: false,
          sessionId,
          message: verification.reason,
        };
      }

      trackAntiAbuseEvent('resource_verification_success', {
        session_id: sessionId,
      });
    }

    return {
      passed: true,
      sessionId,
      message: 'Challenge flow completed successfully',
    };
  } catch (error) {
    trackJSError({
      error_type: 'AntiAbuseChallengeFlowError',
      error_message: error instanceof Error ? error.message : String(error),
      component: 'captcha-client',
      user_action: 'challenge_flow',
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    return {
      passed: false,
      sessionId: 'unknown',
      message: 'Challenge flow failed',
    };
  }
}

/**
 * Check if a session is being challenged based on risk assessment
 */
export function getSessionIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  return params.get('sessionId');
}

/**
 * Get severity level from URL
 */
export function getSeverityFromUrl(): 'low' | 'medium' | 'high' | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const severity = params.get('severity');
  
  if (severity === 'low' || severity === 'medium' || severity === 'high') {
    return severity;
  }
  
  return null;
}
