import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConvexClient } from '@/lib/convex-client';
import { applyRateLimit, RateLimitPresets } from '@/lib/rate-limit';
import { sanitizeString, sanitizeEmail } from '@/lib/sanitize';
import { trackServerAuth, flushServerEvents } from '@/lib/analytics-server';
import { WideEvent } from '@/lib/wide-event';

// Helper function to get JWT_SECRET with validation
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not configured.');
  }
  return secret;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/auth/signin' });

  // Apply rate limiting
  const rateLimitResponse = await applyRateLimit(req, {
    ...RateLimitPresets.auth,
    keyPrefix: 'signin'
  });

  if (rateLimitResponse) {
    wideEvent.setError({ type: 'RateLimitError', message: 'Too many sign-in attempts', code: 'rate_limited' });
    wideEvent.setAuth({ action: 'signin', success: false, failure_reason: 'rate_limited' });
    wideEvent.finish(429);
    return rateLimitResponse;
  }

  try {
    const { emailOrUsername, password } = await req.json();

    if (!emailOrUsername || !password) {
      wideEvent.setError({ type: 'ValidationError', message: 'Missing required fields', code: 'validation_error' });
      wideEvent.setAuth({ action: 'signin', success: false, failure_reason: 'missing_fields' });
      wideEvent.finish(400);
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
      wideEvent.setUser({ id: 'unknown' });
      wideEvent.setAuth({
        action: 'signin',
        method: isEmail ? 'email' : 'username',
        success: false,
        failure_reason: 'user_not_found'
      });
      wideEvent.setError({ type: 'AuthError', message: 'User not found', code: 'user_not_found' });
      wideEvent.finish(401);

      trackServerAuth({
        event_type: 'failed_signin',
        method: isEmail ? 'email' : 'username',
        error_type: 'user_not_found',
      });
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    if (!user.password) {
      wideEvent.setUser({ id: user._id });
      wideEvent.setAuth({
        action: 'signin',
        method: isEmail ? 'email' : 'username',
        success: false,
        failure_reason: 'no_password'
      });
      wideEvent.setError({ type: 'AuthError', message: 'No password set', code: 'no_password' });
      wideEvent.finish(401);

      trackServerAuth({
        event_type: 'failed_signin',
        method: isEmail ? 'email' : 'username',
        error_type: 'no_password',
      });
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      wideEvent.setUser({ id: user._id });
      wideEvent.setAuth({
        action: 'signin',
        method: isEmail ? 'email' : 'username',
        success: false,
        failure_reason: 'invalid_password'
      });
      wideEvent.setError({ type: 'AuthError', message: 'Invalid password', code: 'invalid_password', domain: 'authentication' });
      wideEvent.finish(401);

      trackServerAuth({
        event_type: 'failed_signin',
        method: isEmail ? 'email' : 'username',
        error_type: 'invalid_password',
      });
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      wideEvent.setUser({ id: user._id });
      wideEvent.setAuth({
        action: 'signin',
        method: isEmail ? 'email' : 'username',
        success: false,
        failure_reason: 'email_not_verified'
      });
      wideEvent.setError({ type: 'AuthError', message: 'Email not verified', code: 'email_not_verified' });
      wideEvent.finish(403);

      trackServerAuth({
        event_type: 'failed_signin',
        method: isEmail ? 'email' : 'username',
        error_type: 'email_not_verified',
      });
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
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

    // Log successful sign in with wide event
    wideEvent.setUser({
      id: user._id,
      account_age_days: user.createdAt ? Math.floor((Date.now() - user.createdAt * 1000) / (1000 * 60 * 60 * 24)) : undefined,
    });
    wideEvent.setAuth({
      action: 'signin',
      method: isEmail ? 'email' : 'username',
      success: true,
    });
    wideEvent.setSession({
      id: sessionToken,
      new: !sessionResult.isExisting,
    });
    wideEvent.setCustom('session_created', !sessionResult.isExisting);
    wideEvent.finish(200);

    // Track successful sign in for PostHog events
    trackServerAuth({
      event_type: 'signin',
      method: isEmail ? 'email' : 'username',
    });
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return response;
  } catch (error) {
    // Log error with wide event
    wideEvent.setError(error as Error);
    wideEvent.setAuth({ action: 'signin', success: false, failure_reason: 'server_error' });
    wideEvent.finish(500);

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
