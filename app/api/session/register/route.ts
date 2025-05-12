import { NextRequest, NextResponse } from 'next/server';
import { registerSessionToken, isRedisConfigured } from '@/lib/redis';

export async function POST(req: NextRequest) {
  if (!isRedisConfigured) {
    console.warn("Redis is not configured. Cannot register session token via API.");
    // Depending on policy, you might return a specific error or a success-like response
    // if sessions are optional when Redis is down.
    return NextResponse.json({ success: true, message: "Redis not configured, skipping registration." });
  }

  try {
    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'Token is required and must be a string.' }, { status: 400 });
    }

    const expirationInSeconds = 24 * 60 * 60; // 24 hours, or make this configurable
    const registered = await registerSessionToken(token, expirationInSeconds);

    if (registered) {
      return NextResponse.json({ success: true, message: 'Session token registered.' });
    } else {
      return NextResponse.json({ success: false, error: 'Failed to register session token.' }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in /api/session/register:", error);
    let errorMessage = "Internal server error.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
