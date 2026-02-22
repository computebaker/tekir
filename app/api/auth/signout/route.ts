import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { trackServerAuth, flushServerEvents } from '@/lib/analytics-server';
import { WideEvent } from '@/lib/wide-event';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/auth/signout' });

  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get('session-token')?.value;

    let userId: string | undefined;

    if (sessionToken) {
      // Delete session from Convex
      const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });

      if (session && session._id) {
        userId = session.userId;
        wideEvent.setUser({ id: userId });
        wideEvent.setSession({ id: sessionToken, duration_seconds: Math.floor((Date.now() - session._creationTime) / 1000) });
      }
    }

    // Clear both session and JWT cookies
    const response = NextResponse.json({ success: true });

    // Clear session token cookie
    response.cookies.set('session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0 // Expire immediately
    });

    // Clear JWT auth token cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0 // Expire immediately
    });

    // Log successful signout
    wideEvent.setAuth({ action: 'signout', success: true });
    wideEvent.finish(200);

    // Track signout event
    trackServerAuth({
      event_type: 'signout',
    });
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return response;

  } catch (error) {
    wideEvent.setError(error as Error);
    wideEvent.setAuth({ action: 'signout', success: false, failure_reason: 'server_error' });
    wideEvent.finish(500);

    if (process.env.NODE_ENV === 'development') {
      console.error('Signout error:', error);
    }
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
