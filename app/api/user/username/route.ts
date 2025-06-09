import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const usernameSchema = z.object({
  username: z.string()
    .min(1, 'Username cannot be empty')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .toLowerCase(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username } = usernameSchema.parse(body);

    // Check if username is already in use by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        username: username,
        id: {
          not: session.user.id
        }
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username is already in use' },
        { status: 400 }
      );
    }

    // Update user username
    const updatedUser = await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        username: username
      }
    });

    return NextResponse.json(
      { message: 'Username updated successfully', username: updatedUser.username },
      { status: 200 }
    );

  } catch (error) {
    console.error('Username update error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
