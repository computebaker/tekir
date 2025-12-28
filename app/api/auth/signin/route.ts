import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConvexClient } from '@/lib/convex-client';
import { applyRateLimit, RateLimitPresets } from '@/lib/rate-limit';
import { sanitizeString, sanitizeEmail } from '@/lib/sanitize';

// Helper function to get JWT_SECRET with validation
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not configured.');
  }
  return secret;
}

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await applyRateLimit(req, {
    ...RateLimitPresets.auth,
    keyPrefix: 'signin'
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const { emailOrUsername, password } = await req.json();

    if (!emailOrUsername || !password) {
      return NextResponse.json(
        { error: 'Email/username and password are required' },
        { status: 400 }
      );
    }

    // Sanitize input
    const sanitizedInput = sanitizeString(emailOrUsername.trim());

    const convex = getConvexClient();

    // Check if input is email or username
    const isEmail = sanitizedInput.includes('@');

    // Get user by email or username
    let user;
    if (isEmail) {
      const sanitizedEmail = sanitizeEmail(sanitizedInput);
      user = await convex.query(api.users.getUserByEmail, {
        email: sanitizedEmail
      });
    } else {
      const sanitizedUsername = sanitizedInput.toLowerCase();
      user = await convex.query(api.users.getUserByUsername, {
        username: sanitizedUsername
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in' },
        { status: 403 }
      );
    }

    // Generate JWT token
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

    // Also generate session token for Convex session tracking
    // Store session in Convex for rate limiting (will return existing token if user already has one)
    const sessionResult = await convex.mutation(api.sessions.getOrCreateSessionToken, {
      userId: user._id
    });

    const sessionToken = sessionResult.sessionToken;

    // Set response with user data (NO TOKEN in body - security fix)
    const response = NextResponse.json({
      success: true,
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
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Also set session token for rate limiting
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'development') {
      console.error('Signin error:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
