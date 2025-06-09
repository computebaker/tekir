import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAvatarUrl } from '@/lib/avatar';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the user to use their name/email for avatar generation
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        name: true,
        email: true
      },
      cacheStrategy: { ttl: 300 },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate a new avatar URL with current timestamp to ensure uniqueness
    const avatarSeed = `${user.name || user.email || 'User'}-${Date.now()}`;
    const newAvatarUrl = generateAvatarUrl(avatarSeed);

    // Update user avatar
    const updatedUser = await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        image: newAvatarUrl,
        imageType: 'generated'
      }
    });

    return NextResponse.json(
      { 
        message: 'Avatar regenerated successfully', 
        avatar: updatedUser.image 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Avatar regeneration error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
