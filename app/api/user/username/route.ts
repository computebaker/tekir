import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';

const usernameSchema = z.object({
  username: z.string()
    .min(1, 'Username cannot be empty')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .toLowerCase(),
});

export async function PUT(request: NextRequest) {
  try {
    const user = await getJWTUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { username } = usernameSchema.parse(body);

    const convex = getConvexClient();

    // Check if username is already in use by another user
    const existingUser = await convex.query(api.users.getUserByUsername, { username });

    if (existingUser && existingUser._id !== user.userId) {
      return NextResponse.json(
        { error: 'Username is already in use' },
        { status: 400 }
      );
    }

    // Update user username
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any, // Cast to Convex ID type
      username: username
    });

    return NextResponse.json(
      { message: 'Username updated successfully', username: username },
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
