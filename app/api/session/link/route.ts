import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { linkSessionToUser, isConvexConfigured } from '@/lib/convex-session';
import { RATE_LIMITS } from '@/lib/rate-limits';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/session/link' });
  wideEvent.setCustom('trace_id', traceId);
  
  if (!isConvexConfigured) {
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    return NextResponse.json({ success: true, message: "Convex not configured, skipping session linking." });
  }

  try {
    // Check if user is authenticated
    const user = await getJWTUser(req);
    const userId = user?.userId;
    
    if (!userId) {
      wideEvent.setError({ type: 'AuthError', message: 'User not authenticated', code: 'not_authenticated' });
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ success: false, error: 'User not authenticated.' }, { status: 401 });
    }
    
    wideEvent.setUser({ id: userId });

    // Get the current session token from cookies
    const sessionToken = req.cookies.get('session-token')?.value;
    
    if (!sessionToken) {
      wideEvent.setError({ type: 'SessionError', message: 'No session token found', code: 'no_session_token' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ success: false, error: 'No session token found.' }, { status: 400 });
    }

    // Link the session to the user
    const resultToken = await linkSessionToUser(sessionToken, userId);
    
    if (!resultToken) {
      wideEvent.setError({ type: 'SessionError', message: 'Failed to link session to user', code: 'link_failed' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(500);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ success: false, error: 'Failed to link session to user.' }, { status: 500 });
    }
    
    wideEvent.setCustom('token_changed', resultToken !== sessionToken);
    wideEvent.setSession({ id: resultToken });

    // Create response
    const response = NextResponse.json({ 
      success: true, 
      message: 'Session successfully linked to user account.',
      userId: userId,
      newRequestLimit: RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT,
      sessionToken: resultToken !== sessionToken ? resultToken : undefined // Indicate if token changed
    });

    // Update cookie if the session token changed (fingerprinting returned existing token)
    if (resultToken !== sessionToken) {
      response.cookies.set('session-token', resultToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: RATE_LIMITS.SESSION_EXPIRATION_SECONDS,
        path: '/',
      });
    }
    
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error("Error in /api/session/link:", error);
    
    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Internal server error', code: 'session_link_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
