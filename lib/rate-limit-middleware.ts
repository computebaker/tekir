import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, incrementAndCheckRequestCount } from '@/lib/convex-session';
import { RATE_LIMITS } from '@/lib/rate-limits';

interface RateLimitResult {
  success: boolean;
  response?: NextResponse;
  sessionToken?: string;
}

/**
 * Middleware function to check session token and rate limits for API routes
 * Returns success: true if request should proceed, or success: false with error response
 */
export async function checkRateLimit(
  request: NextRequest,
  routeName: string = 'API'
): Promise<RateLimitResult> {
  // Check for session token
  const sessionToken = request.cookies.get('session-token')?.value;
  
  if (!sessionToken) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Session token required' },
        { status: 401 }
      ),
    };
  }

  // Validate session token
  const isValid = await isValidSessionToken(sessionToken);
  if (!isValid) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid or expired session token' },
        { status: 401 }
      ),
    };
  }

  // Check rate limiting
  const { allowed, currentCount } = await incrementAndCheckRequestCount(sessionToken);
  if (!allowed) {
    console.warn(`Session token ${sessionToken} exceeded request limit for ${routeName}. Count: ${currentCount}`);
    
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Rate limit exceeded',
          currentCount,
          resetTime: new Date(Date.now() + RATE_LIMITS.RESET_INTERVAL_MS).toISOString(),
          message: 'Daily request limit reached. Limit resets at midnight UTC.',
        },
        { status: 429 }
      ),
    };
  }

  return {
    success: true,
    sessionToken,
  };
}

/**
 * Response headers for rate-limited endpoints
 */
export function getRateLimitHeaders(currentCount: number, isAuthenticated: boolean = false) {
  const limit = isAuthenticated ? RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT : RATE_LIMITS.ANONYMOUS_DAILY_LIMIT;
  const remaining = Math.max(0, limit - currentCount);
  const resetTime = new Date();
  resetTime.setUTCHours(24, 0, 0, 0); // Next midnight UTC

  return {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': Math.floor(resetTime.getTime() / 1000).toString(),
    'X-RateLimit-Reset-Time': resetTime.toISOString(),
  };
}
