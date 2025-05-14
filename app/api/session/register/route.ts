import { NextRequest, NextResponse } from 'next/server';
import { registerSessionToken, isRedisConfigured } from '@/lib/redis';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  if (!isRedisConfigured) {
    console.warn("Redis is not configured. Cannot register session token via API.");
    return NextResponse.json({ success: true, message: "Redis not configured, skipping registration." });
  }

  try {
    // Generate a secure session token on the server
    const token = randomBytes(32).toString('hex');

    const expirationInSeconds = 24 * 60 * 60; // 24 hours
    const registered = await registerSessionToken(token, expirationInSeconds);

    if (!registered) {
      return NextResponse.json({ success: false, error: 'Failed to register session token.' }, { status: 500 });
    }
    // Set session token cookie
    const response = NextResponse.json({ success: true, token, message: 'Session token generated and registered.' });
    response.cookies.set('session-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // allow cookies on same-site requests
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
