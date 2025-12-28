import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { validateAndProcessImage } from '@/lib/image-processing';
import { regenerateAvatar } from '@/lib/avatar';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';

const uploadSchema = z.object({
  image: z.string().min(1, 'Image data is required')
});

export async function POST(request: NextRequest) {
  try {
    // Get the auth token from cookies
    const authToken = request.cookies.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getJWTUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const validation = uploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { image } = validation.data;

    // Validate and process the image
    const processedImage = await validateAndProcessImage(image);

    const convex = getConvexClient();

    // Update user's profile picture in the database
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      image: processedImage.base64,
      imageType: 'uploaded'
    });

    return NextResponse.json({
      success: true,
      message: 'Profile picture updated successfully',
      image: processedImage.base64,
      updatedAt: Date.now()
    });

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Profile picture upload error:', error);
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get the auth token from cookies
    const authToken = request.cookies.get('auth-token')?.value;

    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await getJWTUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const convex = getConvexClient();

    // Get the current user data to use for avatar generation
    const userRecord = await convex.query(api.users.getUserById, { id: user.userId as any });

    if (!userRecord) {
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

    return NextResponse.json({
      success: true,
      message: 'Profile picture removed and new avatar generated successfully',
      image: newAvatarUrl,
      imageType: 'generated',
      updatedAt: Date.now()
    });

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error removing profile picture:', error);
    }

    return NextResponse.json(
      { error: 'Failed to remove profile picture' },
      { status: 500 }
    );
  }
}
