import { NextRequest, NextResponse } from "next/server";
import { prelude } from "@/lib/prelude";
import { getConvexClient } from "@/lib/convex-client";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import jwt from 'jsonwebtoken';

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = verifyCodeSchema.parse(body);

    const convex = getConvexClient();

    // Find user
    const user = await convex.query(api.users.getUserByEmail, { email });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email already verified" },
        { status: 400 }
      );
    }

    // Verify code using Prelude
    const check = await prelude.verification.check({
      target: {
        type: "email_address",
        value: email,
      },
      code: code,
    });

    if (check.status !== "success") {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Mark email as verified
    await convex.mutation(api.users.verifyEmail, { email });

    // Generate JWT token for automatic authentication
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        roles: Array.isArray(user.roles) ? user.roles : []
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Generate session token for Convex session tracking
    console.log('VerifyEmail: Generating session for user:', user._id);

    // Store session in Convex for rate limiting
    const sessionResult = await convex.mutation(api.sessions.getOrCreateSessionToken, {
      userId: user._id
    });
    console.log('VerifyEmail: Session result:', sessionResult);

    const sessionToken = sessionResult.sessionToken;

    // Set both JWT and session cookies for automatic authentication
    const response = NextResponse.json({
      message: "Email verified successfully",
      authenticated: true,
      token, // Return JWT token in response
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        username: user.username,
        roles: Array.isArray(user.roles) ? user.roles : []
      }
    });

    // Set JWT token as httpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Also set session token for rate limiting
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

  console.log('VerifyEmail: Email verified and cookies set');

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Email verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
}
