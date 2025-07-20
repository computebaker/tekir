import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';

const emailSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export async function PUT(request: NextRequest) {
  try {
    const user = await getJWTUser(request);
    
    if (!user?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = emailSchema.parse(body);

    const convex = getConvexClient();

    // Check if email is already in use by another user
    const existingUser = await convex.query(api.users.getUserByEmail, { email });

    if (existingUser && existingUser._id !== user.userId) {
      return NextResponse.json(
        { error: 'Email is already in use' },
        { status: 400 }
      );
    }

    // Update user email
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any, // Cast to Convex ID type
      email: email
    });

    return NextResponse.json(
      { message: 'Email updated successfully', email: email },
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
