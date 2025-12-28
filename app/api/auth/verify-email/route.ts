import { NextRequest, NextResponse } from "next/server";
import { prelude } from "@/lib/prelude";
import { getConvexClient } from "@/lib/convex-client";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import jwt from 'jsonwebtoken';
import { sanitizeEmail, sanitizeString, isValidEmail } from "@/lib/sanitize";

// Helper function to get JWT_SECRET with validation
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not configured.');
  }
  return secret;
}

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = verifyCodeSchema.parse(body);

    // Sanitize and validate inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedCode = sanitizeString(code);

    if (!isValidEmail(sanitizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Find user
    const user = await convex.query(api.users.getUserByEmail, { email: sanitizedEmail });

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
        value: sanitizedEmail,
      },
      code: sanitizedCode,
    });

    if (check.status !== "success") {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Mark email as verified
    await convex.mutation(api.users.verifyEmail, { email: sanitizedEmail });

    // Generate JWT token for automatic authentication
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        roles: Array.isArray(user.roles) ? user.roles : []
      },
      getJWTSecret(),
      { expiresIn: '7d' }
    );

    // Generate session token for Convex session tracking
    const sessionResult = await convex.mutation(api.sessions.getOrCreateSessionToken, {
      userId: user._id
    });

    const sessionToken = sessionResult.sessionToken;

    // Set both JWT and session cookies for automatic authentication
    const response = NextResponse.json({
      message: "Email verified successfully",
      authenticated: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        username: user.username,
        roles: Array.isArray(user.roles) ? user.roles : []
      }
    });

    // Set JWT token as httpOnly cookie with strict SameSite
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Also set session token for rate limiting
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.error("Email verification error:", error);
    }
    return NextResponse.json(
      { error: "Failed to verify email" },
      { status: 500 }
    );
  }
}
