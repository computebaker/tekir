import { NextRequest, NextResponse } from 'next/server';
import { registerSessionToken, isRedisConfigured } from '@/lib/redis';
import { createHash } from 'crypto';

// Function to get client IP address from request
function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list of IPs. The first one is the client's.
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return null;
}

// Function to hash the IP address
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

export async function POST(req: NextRequest) {
  if (!isRedisConfigured) {
    console.warn("Redis is not configured. Cannot register session token via API.");
    return NextResponse.json({ success: true, message: "Redis not configured, skipping registration." });
  }

  try {
    const clientIp = getClientIp(req);
    let hashedIp: string | null = null;

    if (clientIp) {
      hashedIp = hashIp(clientIp);
    } else {
      console.warn("Could not determine client IP address. Session will not be tied to IP.");
    }

    const expirationInSeconds = 24 * 60 * 60;
    
    const token = await registerSessionToken(hashedIp, expirationInSeconds);

    if (!token) {
      return NextResponse.json({ success: false, error: 'Failed to register session token.' }, { status: 500 });
    }
    
    const response = NextResponse.json({ success: true, token, message: 'Session token processed.' });
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
