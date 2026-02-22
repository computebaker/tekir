import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { validateAndProcessImage } from '@/lib/image-processing';
import { regenerateAvatar } from '@/lib/avatar';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

const uploadSchema = z.object({
  image: z.string().min(1, 'Image data is required')
});

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/user/avatar/upload' });
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

    // Parse the request body
    const body = await request.json();
    const validation = uploadSchema.safeParse(body);

    if (!validation.success) {
      wideEvent.setError({ type: 'ValidationError', message: 'Invalid request data', code: 'validation_error' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { image } = validation.data;
    
    wideEvent.setCustom('image_data_length', image.length);

    // Validate and process the image
    const processedImage = await validateAndProcessImage(image);

    const convex = getConvexClient();

    // Update user's profile picture in the database
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      image: processedImage.base64,
      imageType: 'uploaded'
    });
    
    wideEvent.setCustom('operation_type', 'avatar_upload');
    wideEvent.setCustom('processed_image_size', processedImage.base64.length);
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json({
      success: true,
      message: 'Profile picture updated successfully',
      image: processedImage.base64,
      updatedAt: Date.now()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.error('Profile picture upload error:', error);
    }

    if (error instanceof z.ZodError) {
      wideEvent.setError({ type: 'ValidationError', message: 'Validation failed', code: 'validation_error' });
      wideEvent.setCustom('latency_ms', duration);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Failed to upload profile picture', code: 'avatar_upload_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'DELETE', path: '/api/user/avatar/upload' });
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

    const convex = getConvexClient();

    // Get the current user data to use for avatar generation
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

    // Generate a new avatar URL using the regenerate function
    const newAvatarUrl = regenerateAvatar(userRecord._id, userRecord.email);

    // Update user's profile picture in the database with the new generated avatar
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      image: newAvatarUrl,
      imageType: 'generated'
    });
    
    wideEvent.setCustom('operation_type', 'avatar_delete_and_regenerate');
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json({
      success: true,
      message: 'Profile picture removed and new avatar generated successfully',
      image: newAvatarUrl,
      imageType: 'generated',
      updatedAt: Date.now()
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.error('Error removing profile picture:', error);
    }

    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Failed to remove profile picture', code: 'avatar_delete_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { error: 'Failed to remove profile picture' },
      { status: 500 }
    );
  }
}
