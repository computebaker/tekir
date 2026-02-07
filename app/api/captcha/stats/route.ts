/**
 * Admin endpoint for CAPTCHA system monitoring and statistics
 * GET /api/captcha/stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChallengeStats, getSession } from '@/lib/captcha-dispatcher';
import { getPostHogServer } from '@/lib/posthog-server';

function captureCaptchaEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  const posthog = getPostHogServer();
  posthog.capture({
    distinctId: 'captcha_admin',
    event,
    properties,
  });
  posthog.flush();
}

// Simple auth check - in production, use proper admin authentication
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminToken = process.env.CAPTCHA_ADMIN_TOKEN;

  if (!adminToken) {
    return false; // No admin token configured, deny access
  }

  return authHeader === `Bearer ${adminToken}`;
}

export async function GET(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const stats = getChallengeStats();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    captureCaptchaEvent('captcha_stats_error', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'Failed to retrieve stats' },
      { status: 500 }
    );
  }
}

// Endpoint to check a specific session (for debugging)
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      timestamp: new Date(session.timestamp).toISOString(),
      expiresAt: new Date(session.expiresAt).toISOString(),
      userAgent: session.userAgent,
      riskScore: session.riskScore,
      isChallenged: session.isChallenged,
      verified: session.verified,
      resourcesLoaded: {
        js: Array.from(session.resourcesLoadTracker.jsLoaded),
        css: Array.from(session.resourcesLoadTracker.cssLoaded),
      },
    });
  } catch (error) {
    captureCaptchaEvent('captcha_session_check_error', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}
