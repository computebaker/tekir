import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

export async function DELETE(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'DELETE', path: '/api/user/delete' });
  wideEvent.setCustom('trace_id', traceId);
  
  try {
    const user = await getJWTUser(request);
    
    if (!user) {
      wideEvent.setError({ type: 'AuthError', message: 'Invalid JWT user', code: 'invalid_jwt' });
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const convex = getConvexClient();

    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      wideEvent.setError({ type: 'AuthError', message: 'Missing auth token', code: 'no_auth_token' });
      wideEvent.finish(401);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    wideEvent.setUser({ id: user.userId });

    // Check if user exists
    const userRecord = await convex.query(api.users.getUserById, { id: user.userId as any });

    if (!userRecord) {
      wideEvent.setError({ type: 'AuthError', message: 'User not found', code: 'user_not_found' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(404);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user (this will cascade delete related data in our deleteUser mutation)
  await convex.mutation(api.users.deleteUser, { authToken, id: user.userId as any });
  
    wideEvent.setCustom('operation_type', 'account_delete');
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.error('Account deletion error:', error);
    }

    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Internal server error', code: 'account_deletion_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
