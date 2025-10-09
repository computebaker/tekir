import { verifySolution } from 'ribaunt';
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.RIBAUNT_SECRET!);

export async function POST(request: NextRequest) {
  try {
    const { tokens, solutions } = await request.json();

    // Verify the CAPTCHA solution
    const isValid = verifySolution(tokens, solutions);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid solution' },
        { status: 400 }
      );
    }

    // Create a verification JWT valid for 24 hours
    const verificationToken = await new SignJWT({ verified: true })
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
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
