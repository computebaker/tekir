/**
 * Enhanced middleware for anti-abuse CAPTCHA challenge dispatch
 * Can be integrated into the main proxy.ts file
 */

import { NextRequest, NextResponse } from 'next/server';
import { dispatchChallenge } from '@/lib/captcha-dispatcher';

const POSTHOG_PROJECT_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

function captureAntiAbuseMiddlewareEvent(
  event: string,
  properties: Record<string, string | number | boolean | null | undefined>,
  distinctId = 'antiabuse_middleware'
) {
  if (!POSTHOG_PROJECT_KEY) return;

  const payload = {
    api_key: POSTHOG_PROJECT_KEY,
    event,
    distinct_id: distinctId,
    properties: {
      ...properties,
      server_event: true,
      environment: process.env.NODE_ENV || 'unknown',
    },
  };

  void fetch(`${POSTHOG_HOST}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

export interface AntiAbuseMiddlewareOptions {
  enabled: boolean;
  hardThreshold?: number;
  softThreshold?: number;
  excludePaths?: string[];
  headerNames?: string[];
}

export function createAntiAbuseMiddleware(
  options: AntiAbuseMiddlewareOptions = {
    enabled: true,
    hardThreshold: 60,
    softThreshold: 40,
  }
) {
  return async (request: NextRequest) => {
    if (!options.enabled) {
      return NextResponse.next();
    }

    const { pathname } = request.nextUrl;

    // Skip middleware for excluded paths
    const defaultExcludes = [
      '/api/captcha',
      '/_next/',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
    ];
    const excludePaths = options.excludePaths ?? defaultExcludes;

    if (excludePaths.some((path) => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // Collect headers for analysis
    const userAgent = request.headers.get('user-agent') ?? '';
    const headers: Record<string, string | undefined> = {};

    const headerNames = options.headerNames ?? [
      'user-agent',
      'accept-language',
      'accept-encoding',
      'accept',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'sec-fetch-site',
      'sec-fetch-mode',
      'sec-fetch-dest',
      'referer',
      'origin',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-real-ip',
      'cf-ray',
      'cf-connecting-ip',
    ];

    for (const name of headerNames) {
      headers[name] = request.headers.get(name) ?? undefined;
    }

    // Dispatch challenge based on fingerprint
    const challenge = dispatchChallenge({
      headers,
      userAgent,
      hardThreshold: options.hardThreshold,
      softThreshold: options.softThreshold,
    });

    // If user has valid verification cookie, allow through
    const verificationCookie = request.cookies.get('__ribaunt_verification_key')?.value;
    if (verificationCookie) {
      captureAntiAbuseMiddlewareEvent('antiabuse_middleware_allow', {
        reason: 'verification_cookie',
        pathname,
      });
      return NextResponse.next();
    }

    // If challenge is required, redirect to challenge with risk info
    if (challenge.shouldChallenge) {
      captureAntiAbuseMiddlewareEvent('antiabuse_middleware_challenge', {
        severity: challenge.severity,
        reason: challenge.reason,
        session_id: challenge.sessionId,
        pathname,
      }, challenge.sessionId);

      // Store challenge info in response headers for logging
      const url = request.nextUrl.clone();
      url.pathname = '/captcha';
      url.searchParams.set('returnUrl', pathname);
      url.searchParams.set('sessionId', challenge.sessionId);
      url.searchParams.set('severity', challenge.severity);

      return NextResponse.rewrite(url, {
        request: {
          headers: request.headers,
        },
      });
    }

    // No challenge needed, allow through
    captureAntiAbuseMiddlewareEvent('antiabuse_middleware_allow', {
      reason: 'no_challenge',
      pathname,
    });
    return NextResponse.next();
  };
}

export default createAntiAbuseMiddleware({
  enabled: process.env.ENABLE_ANTI_ABUSE_CAPTCHA === 'true',
});
