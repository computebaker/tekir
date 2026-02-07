import { verifySolution } from 'ribaunt';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { markSessionVerified } from '@/lib/captcha-dispatcher';
import { getPostHogServer } from '@/lib/posthog-server';

function captureCaptchaEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {},
) {
  const posthog = getPostHogServer();
  posthog.capture({
    distinctId,
    event,
    properties,
  });
  posthog.flush();
}

const secret = new TextEncoder().encode(process.env.RIBAUNT_SECRET!);

export async function POST(request: NextRequest) {
  try {
    const { tokens, solutions, sessionId } = await request.json();

    // Verify the CAPTCHA solution
    const isValid = verifySolution(tokens, solutions);

    if (!isValid) {
      captureCaptchaEvent('captcha_solution_invalid', sessionId ?? 'captcha_api');
      return NextResponse.json(
        { error: 'Invalid solution' },
        { status: 400 }
      );
    }

    // Mark the session as verified in anti-abuse system
    if (sessionId) {
      markSessionVerified(sessionId);
      captureCaptchaEvent('captcha_solution_verified', sessionId);
    }

    // Create a verification JWT valid for 24 hours
    const verificationToken = await new SignJWT({ verified: true, sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    // Set the verification cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set('__ribaunt_verification_key', verificationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 48, // 48 hours
      path: '/',
    });

    return response;
  } catch (error) {
    captureCaptchaEvent('captcha_verify_error', 'captcha_api', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
