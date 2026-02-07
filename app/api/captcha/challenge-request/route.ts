/**
 * API endpoint for challenge generation with anti-abuse analysis
 * GET /api/captcha/challenge-request
 */

import { NextRequest, NextResponse } from 'next/server';
import { dispatchChallenge } from '@/lib/captcha-dispatcher';
import { getPostHogServer } from '@/lib/posthog-server';

function captureCaptchaEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  const posthog = getPostHogServer();
  posthog.capture({
    distinctId: 'captcha_api',
    event,
    properties,
  });
  posthog.flush();
}

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') ?? '';
    
    // Collect relevant headers for analysis
    const headers: Record<string, string | undefined> = {};
    const headerNames = [
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
      'via',
    ];

    for (const name of headerNames) {
      headers[name] = request.headers.get(name) ?? undefined;
    }

    // Dispatch challenge based on fingerprint analysis
    const challenge = dispatchChallenge({
      headers,
      userAgent,
      rateLimit: false,
    });

    // If not challenging, return minimal response
    if (!challenge.shouldChallenge) {
      return NextResponse.json({
        required: false,
        sessionId: challenge.sessionId,
        message: 'Challenge not required',
      });
    }

    // Return challenge payload
    const requiredResources = challenge.payload && 'requiredResources' in challenge.payload
      ? (challenge.payload as any).requiredResources
      : {
          js: '/captcha/resources/verify.js',
          css: '/captcha/resources/verify.css',
        };

    return NextResponse.json({
      required: true,
      sessionId: challenge.sessionId,
      severity: challenge.severity,
      reason: challenge.reason,
      payload: challenge.payload,
      // Client will need to load these resources to prove it's not a bot
      resources: requiredResources,
    });
  } catch (error) {
    captureCaptchaEvent('captcha_challenge_request_error', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'Failed to process challenge request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Allow HEAD requests for resource validation
  return POST(request);
}
