import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

const emailSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export async function PUT(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'PUT', path: '/api/user/email' });
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

    if (!user?.userId) {
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
    const { email } = emailSchema.parse(body);
    
    wideEvent.setCustom('new_email_length', email.length);

    const convex = getConvexClient();

    // Check if email is already in use by another user
    const existingUser = await convex.query(api.users.getUserByEmail, { email });

    if (existingUser && existingUser._id !== user.userId) {
      wideEvent.setError({ type: 'ValidationError', message: 'Email already in use', code: 'email_in_use' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 400 }
      );
    }

    // Update user email
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      email: email
    });
    
    wideEvent.setCustom('operation_type', 'email_update');
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { message: 'Email updated successfully', email: email },
      { status: 200 }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.error('Email update error:', error);
    }

    if (error instanceof z.ZodError) {
      wideEvent.setError({ type: 'ValidationError', message: 'Invalid email format', code: 'validation_error' });
      wideEvent.setCustom('latency_ms', duration);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Internal server error', code: 'email_update_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
