import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { registerSessionToken, isConvexConfigured, hashIp, getRateLimitStatus } from '@/lib/convex-session';
import { getJWTUser } from '@/lib/jwt-auth';
import { RATE_LIMITS, getUserRateLimit, getSessionExpiration } from '@/lib/rate-limits';

// Function to get client IP address from request
function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }

  return null;
}

export async function POST(req: NextRequest) {
  if (!isConvexConfigured) {
    console.warn("Convex is not configured. Cannot register session token via API.");
    return NextResponse.json({ success: true, message: "Convex not configured, skipping registration." });
  }

  try {
    // Check if user is authenticated
    const user = await getJWTUser(req);
    const userId = user?.userId || null;

    const clientIp = getClientIp(req);
    let hashedIpValue: string | null = null;

    if (clientIp) {
      hashedIpValue = hashIp(clientIp);
    } else {
      console.warn("Could not determine client IP address. Session will not be tied to IP.");
    }

    const expirationInSeconds = getSessionExpiration();

    // Derive or create a stable device identifier (opaque random ID)
    let deviceId = req.cookies.get('device-id')?.value || null;
    if (!deviceId) {
      // 16-byte random hex ID
      deviceId = randomBytes(16).toString('hex');
    }

    // Pass userId to link session to authenticated user and include deviceId
    const token = await registerSessionToken(hashedIpValue, expirationInSeconds, userId, deviceId);

    if (!token) {
      return NextResponse.json({ success: false, error: 'Failed to register session token.' }, { status: 500 });
    }
    
    // Fetch current rate limit status so client can show accurate remaining uses
    let status: { currentCount: number; limit: number; remaining: number; isAuthenticated: boolean } | null = null;
    try {
      const s = await getRateLimitStatus(token);
      status = {
        currentCount: s.currentCount ?? 0,
        limit: s.limit ?? getUserRateLimit(!!userId),
        remaining: s.remaining ?? getUserRateLimit(!!userId),
        isAuthenticated: !!(s.isAuthenticated ?? userId)
      };
    } catch (e) {
      // Fall back to static values if Convex status fails
      status = {
        currentCount: 0,
        limit: getUserRateLimit(!!userId),
        remaining: getUserRateLimit(!!userId),
        isAuthenticated: !!userId
      };
    }

    const response = NextResponse.json({ 
      success: true, 
      token, 
      message: 'Session token processed.',
      userLinked: !!userId,
      requestLimit: status.limit,
      currentCount: status.currentCount,
      remaining: status.remaining,
      isAuthenticated: status.isAuthenticated
    });
    response.cookies.set('session-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expirationInSeconds,
      path: '/',
    });
    // Set/update non-HTTP-only device-id cookie (pseudonymous; used only for anti-abuse)
    response.cookies.set('device-id', deviceId!, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
    return response;
  } catch (error) {
    console.error("Error in /api/session/register:", error);
    let errorMessage = "Internal server error.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
