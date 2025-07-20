import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { validateAndProcessImage } from '@/lib/image-processing';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';

const uploadSchema = z.object({
  image: z.string().min(1, 'Image data is required')
});

export async function POST(request: NextRequest) {
  try {
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
    console.error('Profile picture upload error:', error);
    
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
    const user = await getJWTUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const convex = getConvexClient();

    // Remove the user's custom profile picture and reset to generated avatar
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      image: undefined, // This will be set to null in the mutation
      imageType: undefined
    });

    return NextResponse.json({
      success: true,
      message: 'Profile picture removed successfully',
      updatedAt: Date.now()
    });

  } catch (error) {
    console.error('Error removing profile picture:', error);
    
    return NextResponse.json(
      { error: 'Failed to remove profile picture' },
      { status: 500 }
    );
  }
}
