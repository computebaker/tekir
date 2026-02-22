import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

const usernameSchema = z.object({
  username: z.string()
    .min(1, 'Username cannot be empty')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .toLowerCase(),
});

export async function PUT(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'PUT', path: '/api/user/username' });
  wideEvent.setCustom('trace_id', traceId);
  
  try {
    // Get the auth token from cookies
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
    
    wideEvent.setUser({ id: user.userId });

    const body = await request.json();
    const { username } = usernameSchema.parse(body);
    
    wideEvent.setCustom('new_username_length', username.length);

    const convex = getConvexClient();

    // Check if username is already in use by another user
    const existingUser = await convex.query(api.users.getUserByUsername, { username });

    if (existingUser && existingUser._id !== user.userId) {
      wideEvent.setError({ type: 'ValidationError', message: 'Username already in use', code: 'username_in_use' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Username is already in use' },
        { status: 400 }
      );
    }

    // Update user username
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      username: username
    });
    
    wideEvent.setCustom('operation_type', 'username_update');
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { message: 'Username updated successfully', username: username },
      { status: 200 }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.error('Username update error:', error);
    }

    if (error instanceof z.ZodError) {
      wideEvent.setError({ type: 'ValidationError', message: error.errors[0].message, code: 'validation_error' });
      wideEvent.setCustom('latency_ms', duration);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Internal server error', code: 'username_update_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
