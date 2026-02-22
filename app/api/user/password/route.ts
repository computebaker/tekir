import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters long')
    .max(100, 'New password cannot exceed 100 characters'),
});

export async function PUT(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'PUT', path: '/api/user/password' });
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
    const { currentPassword, newPassword } = passwordSchema.parse(body);

    const convex = getConvexClient();

    // Get the user with their current password
    const userRecord = await convex.query(api.users.getUserById, { id: user.userId as any });

    if (!userRecord || !userRecord.password) {
      wideEvent.setError({ type: 'AuthError', message: 'User not found or password not set', code: 'user_not_found' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(404);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'User not found or password not set' },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userRecord.password);

    if (!isCurrentPasswordValid) {
      wideEvent.setError({ type: 'AuthError', message: 'Current password is incorrect', code: 'invalid_current_password' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      password: hashedNewPassword
    });
    
    wideEvent.setCustom('operation_type', 'password_update');
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { message: 'Password changed successfully' },
      { status: 200 }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.error('Password change error:', error);
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

    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Internal server error', code: 'password_update_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
