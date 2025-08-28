import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { regenerateAvatar } from '@/lib/avatar';
import { api } from '@/convex/_generated/api';

export async function POST(request: NextRequest) {
  try {
    const user = await getJWTUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const convex = getConvexClient();

    // Get the user to use their name/email for avatar generation
    const userRecord = await convex.query(api.users.getUserById, { id: user.userId as any });

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate a new avatar URL using the regenerate function which includes timestamp for uniqueness
    const newAvatarUrl = regenerateAvatar(userRecord._id, userRecord.email);

    // Update user avatar - store the URL and mark as generated
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      image: newAvatarUrl,
      imageType: 'generated'
    });

    return NextResponse.json({
      success: true,
      message: "Avatar regenerated successfully",
      avatar: newAvatarUrl,
      updatedAt: Date.now()
    });

  } catch (error) {
    console.error('Avatar regeneration error:', error);
    
    return NextResponse.json(
      { error: 'Failed to regenerate avatar' },
      { status: 500 }
    );
  }
}
