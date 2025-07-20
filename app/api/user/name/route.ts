import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { z } from 'zod';
import { api } from '@/convex/_generated/api';

const nameSchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
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
    const { name } = nameSchema.parse(body);

    const convex = getConvexClient();

    // Update user name (display name)
    await convex.mutation(api.users.updateUser, {
      id: user.userId as any, // Cast to Convex ID type
      name: name
    });

    return NextResponse.json(
      { message: 'Name updated successfully', name: name },
      { status: 200 }
    );

  } catch (error) {
    console.error('Name update error:', error);
    
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
