import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateAndProcessImage } from '@/lib/image-processing';
import { z } from 'zod';

const uploadSchema = z.object({
  image: z.string().min(1, 'Image data is required')
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
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

    // Update user's profile picture in the database
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        image: processedImage.base64,
        imageType: 'uploaded',
        updatedAt: new Date()
      },
      select: {
        id: true,
        image: true,
        imageType: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile picture updated successfully',
      avatar: updatedUser.image,
      updatedAt: updatedUser.updatedAt
    });

  } catch (error) {
    console.error('Error uploading profile picture:', error);
    
    let errorMessage = 'Failed to upload profile picture';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Remove the user's custom profile picture and reset to generated avatar
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        image: null,
        imageType: null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile picture removed successfully',
      updatedAt: updatedUser.updatedAt
    });

  } catch (error) {
    console.error('Error removing profile picture:', error);
    
    return NextResponse.json(
      { error: 'Failed to remove profile picture' },
      { status: 500 }
    );
  }
}
