import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'GET', path: '/api/auth/session-check' });
  wideEvent.setCustom('trace_id', traceId);
  
  try {
    // Get session token from cookie instead of Authorization header
    const sessionToken = request.cookies.get('session-token')?.value;

    if (!sessionToken) {
      wideEvent.setError({ type: 'AuthError', message: 'No session token', code: 'no_session_token' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ error: 'No valid session token' }, { status: 401 });
    }

    // Get session from Convex
    const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });

    if (!session || !session.userId) {
      wideEvent.setError({ type: 'AuthError', message: 'Invalid session token', code: 'invalid_session_token' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    // Get user data
    const user = await convex.query(api.users.getUserById, { id: session.userId });

    if (!user) {
      wideEvent.setError({ type: 'AuthError', message: 'User not found', code: 'user_not_found' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }
    
    wideEvent.setUser({ id: user._id });

    // Return user data
    wideEvent.setAuth({ method: 'session', success: true });
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    
    return NextResponse.json({
      id: user._id,
      email: user.email,
      username: user.username,
      name: user.name,
      image: user.image,
      avatar: user.image,
      isEmailVerified: !!user.emailVerified,
      settings: user.settings,
      roles: Array.isArray(user.roles) ? user.roles : []
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.error('Session check error:', error);
    }
    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Failed to check session', code: 'session_check_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    return NextResponse.json(
      { error: 'Failed to check session' },
      { status: 500 }
    );
  }
}
