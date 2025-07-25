import { NextRequest, NextResponse } from 'next/server';
import { registerSessionToken, isConvexConfigured, hashIp } from '@/lib/convex-session';
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
    
    // Pass userId to link session to authenticated user
    const token = await registerSessionToken(hashedIpValue, expirationInSeconds, userId);

    if (!token) {
      return NextResponse.json({ success: false, error: 'Failed to register session token.' }, { status: 500 });
    }
    
    const response = NextResponse.json({ 
      success: true, 
      token, 
      message: 'Session token processed.',
      userLinked: !!userId,
      requestLimit: getUserRateLimit(!!userId)
    });
    response.cookies.set('session-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expirationInSeconds,
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
