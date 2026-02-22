/**
 * Endpoint to track resource loads (JS/CSS verification)
 * POST /api/captcha/resource-loaded
 * 
 * This verifies that the client actually loaded and executed
 * the JavaScript and CSS we sent, proving it's not a headless bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordResourceLoad } from '@/lib/captcha-dispatcher';
import { checkRateLimit } from '@/lib/rate-limit';
import { getPostHogServer } from '@/lib/posthog-server';

function captureCaptchaEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {},
) {
  const posthog = getPostHogServer();
  posthog.capture({
    distinctId,
    event,
    properties,
  });
  posthog.flush();
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(request, {
      keyPrefix: 'captcha-resource-loaded',
      maxRequests: 30,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      captureCaptchaEvent('captcha_resource_rate_limited', 'captcha_api', {
        endpoint: 'resource-loaded',
      });
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: new Headers(rateLimit.headers as unknown as Record<string, string>) }
      );
    }

    const body = await request.json();
    const { sessionId, resourcePath, type } = body;

    if (!sessionId || !resourcePath || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, resourcePath, type' },
        { status: 400 }
      );
    }

    if (type !== 'js' && type !== 'css') {
      return NextResponse.json(
        { error: 'Invalid resource type. Must be "js" or "css"' },
        { status: 400 }
      );
    }

    // Record the resource load
    const recorded = recordResourceLoad(sessionId, resourcePath, type);

    if (!recorded) {
      captureCaptchaEvent('captcha_resource_session_not_found', sessionId, {
        resourcePath,
        type,
      });
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${type.toUpperCase()} resource tracked`,
    });
  } catch (error) {
    captureCaptchaEvent('captcha_resource_tracking_error', 'captcha_api', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'Failed to track resource load' },
      { status: 500 }
    );
  }
}
