import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitStatus } from '@/lib/convex-session';
import { getUserRateLimit, RATE_LIMITS } from '@/lib/rate-limits';
import { getJWTUser } from '@/lib/jwt-auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Session token required' }, { status: 401 });
    }

    // Check if user is actually authenticated via JWT
    const jwtUser = await getJWTUser(req);
    const isActuallyAuthenticated = !!jwtUser;

    const s: any = await getRateLimitStatus(token);
    if (!s || !s.isValid) {
      return NextResponse.json({ error: 'Invalid or expired session token' }, { status: 401 });
    }

    // Use JWT auth status to determine limits, not session userId
    const limit = getUserRateLimit(isActuallyAuthenticated);
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

    return NextResponse.json({
      limit,
      remaining,
      currentCount: current,
      isAuthenticated: isActuallyAuthenticated,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}