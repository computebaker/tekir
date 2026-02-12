import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';
import { getSessionExpiration } from '@/lib/rate-limits';

// Helper function to get JWT_SECRET with validation
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not configured.');
  }
  return secret;
}

export async function GET(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'GET', path: '/api/auth/verify-jwt' });
  wideEvent.setCustom('trace_id', traceId);
  
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    const sessionToken = request.cookies.get('session-token')?.value;
    const deviceId = request.cookies.get('device-id')?.value;

    if (!authToken) {
      wideEvent.setError({ type: 'AuthError', message: 'No auth token', code: 'no_auth_token' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ authenticated: false });
    }

    try {
      const decoded = jwt.verify(authToken, getJWTSecret(), { algorithms: ['HS256'] }) as any;

      // Fetch the latest user data from Convex database
      const convex = getConvexClient();
      const user = await convex.query(api.users.getUserById, { id: decoded.userId });

      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.log('JWT verification failed: User not found in database');
        }
        wideEvent.setError({ type: 'AuthError', message: 'User not found', code: 'user_not_found' });
        wideEvent.setCustom('latency_ms', Date.now() - startTime);
        wideEvent.finish(401);
        flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
        return NextResponse.json({ authenticated: false });
      }
      
      wideEvent.setUser({ id: user._id });

      let refreshedSessionToken: string | null = null;
      let sessionInvalid = false;

      // If a session token exists, verify it's valid and linked to this user
      if (sessionToken) {
        try {
          const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });
          if (!session || !session.isActive || session.expiresAt <= Date.now() || String(session.userId) !== String(user._id)) {
            sessionInvalid = true;
          }
        } catch (e) {
          sessionInvalid = true;
        }
      } else {
        sessionInvalid = true;
      }

      if (sessionInvalid) {
        try {
          const sessionResult = await convex.mutation(api.sessions.getOrCreateSessionToken, {
            userId: user._id,
            deviceId: deviceId || undefined,
            expirationInSeconds: getSessionExpiration(),
          });
          refreshedSessionToken = sessionResult.sessionToken;
          wideEvent.setCustom('session_refreshed', true);
        } catch (e) {
          // If session refresh fails, continue with JWT auth (rate-limits may be unavailable)
          wideEvent.setCustom('session_refresh_failed', true);
        }
      }

      wideEvent.setAuth({ action: 'verify', method: 'session', success: true });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(200);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      
      const response = NextResponse.json({
        authenticated: true,
        // Return token for Convex authentication (token is from HttpOnly cookie - user already has it)
        token: authToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          image: user.image,
          imageType: user.imageType,
          avatar: user.image,
          updatedAt: user.updatedAt,
          isEmailVerified: !!user.emailVerified,
          roles: Array.isArray(user.roles) ? user.roles : []
        }
      });
      
      if (refreshedSessionToken) {
        response.cookies.set('session-token', refreshedSessionToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: getSessionExpiration(),
          path: '/',
        });
      }

      return response;
    } catch (jwtError) {
      if (process.env.NODE_ENV === 'development') {
        console.log('JWT verification failed:', jwtError);
      }
      wideEvent.setError({ type: 'AuthError', message: 'JWT verification failed', code: 'jwt_verify_error' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ authenticated: false });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    if (process.env.NODE_ENV === 'development') {
      console.error('Verify JWT error:', error);
    }
    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'JWT verification error', code: 'verify_jwt_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    return NextResponse.json({ authenticated: false });
  }
}
