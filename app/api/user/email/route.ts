import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email('Invalid email format'),
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
    const { email } = emailSchema.parse(body);

    // Check if email is already in use by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email,
        id: {
          not: session.user.id
        }
      },
      cacheStrategy: { ttl: 60 }, 
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 400 }
      );
    }

    // Update user email
    const updatedUser = await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        email: email
      }
    });

    return NextResponse.json(
      { message: 'Email updated successfully', email: updatedUser.email },
      { status: 200 }
    );

  } catch (error) {
    console.error('Email update error:', error);
    
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
