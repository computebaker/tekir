import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitStatus } from '@/lib/convex-session';
import { getUserRateLimit, RATE_LIMITS } from '@/lib/rate-limits';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents, trackServerLog } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'GET', path: '/api/session/status' });
  wideEvent.setCustom('trace_id', traceId);
  
  trackServerLog('session_status_check_request', {
    trace_id: traceId,
  });

  try {
    const token = req.cookies.get('session-token')?.value;
    if (!token) {
      trackServerLog('session_token_missing', {
        trace_id: traceId,
      });
      wideEvent.setError({ type: 'SessionError', message: 'Session token required', code: 'no_token' });
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ error: 'Session token required' }, { status: 401 });
    }

    // JWT is used only to establish whether the request is authenticated and to identify the user.
    // Limits must not be derived from JWT claims (they can become stale until re-login).
    const jwtUser = await getJWTUser(req);
    const isActuallyAuthenticated = !!jwtUser;
    
    if (jwtUser) {
      wideEvent.setUser({ id: jwtUser.userId });
    }
    
    wideEvent.setCustom('is_authenticated', isActuallyAuthenticated);

    // Resolve latest roles from Convex so subscription downgrades reflect immediately.
    let liveRoles: string[] | undefined;
    if (jwtUser?.userId) {
      try {
        const convex = getConvexClient();
  const u = await convex.query(api.users.getUserById, { id: jwtUser.userId as any });
        liveRoles = Array.isArray((u as any)?.roles) ? (u as any).roles : undefined;
      } catch (e: any) {
        console.warn('[Session] Failed to fetch live roles from Convex, falling back to JWT roles');
        liveRoles = Array.isArray((jwtUser as any)?.roles) ? (jwtUser as any).roles : undefined;
      }
    }

    trackServerLog('session_jwt_auth_status', {
      trace_id: traceId,
      is_authenticated: isActuallyAuthenticated,
      has_user_id: Boolean(jwtUser?.userId),
    }, jwtUser?.userId);

    const s: any = await getRateLimitStatus(token);
    if (!s || !s.isValid) {
      trackServerLog('session_token_invalid', {
        trace_id: traceId,
      }, jwtUser?.userId);
      wideEvent.setError({ type: 'SessionError', message: 'Invalid or expired session token', code: 'invalid_token' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ error: 'Invalid or expired session token' }, { status: 401 });
    }

    trackServerLog('session_token_valid', {
      trace_id: traceId,
      current_count: s.currentCount,
      remaining: s.remaining,
    }, jwtUser?.userId);

  // Use JWT only for auth status; use live roles from DB for limit decisions.
  const limit = getUserRateLimit(isActuallyAuthenticated, liveRoles);
    const current = typeof s.currentCount === 'number' ? s.currentCount : 0;
    
    // Convex calculates remaining based on session's stored userId, which may be wrong for logged out users
    let remaining: number;
    if (isActuallyAuthenticated) {
      remaining = typeof s.remaining === 'number' ? s.remaining : (limit - current);
    } else {
      // Convex treated session as authenticated (300 limit), but we want 150 limit
      const convexRemaining = typeof s.remaining === 'number' ? s.remaining : (RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT - current);
      // If Convex remaining equals what it would be with authenticated limit, it was session-limited, so adjust to anonymous limit
      if (convexRemaining === Math.max(0, RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT - current)) {
        remaining = Math.max(0, RATE_LIMITS.ANONYMOUS_DAILY_LIMIT - current);
      } else {
        remaining = convexRemaining;
      }
    }
    remaining = Math.max(0, remaining);

    trackServerLog('session_rate_limit_status', {
      trace_id: traceId,
      limit,
      remaining,
      current,
    }, jwtUser?.userId);
    
    wideEvent.setCustom('limit', limit);
    wideEvent.setCustom('remaining', remaining);
    wideEvent.setCustom('current_count', current);
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json({
      limit,
      remaining,
      currentCount: current,
      isAuthenticated: isActuallyAuthenticated,
    });
  } catch (e: any) {
    const duration = Date.now() - startTime;
    
    console.error(`[Session] Error checking status:`, e?.message || e);
    
    wideEvent.setError({ type: e?.name || 'UnknownError', message: e?.message || 'Internal Server Error', code: 'session_status_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}