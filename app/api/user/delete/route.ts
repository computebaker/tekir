import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';

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

    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user exists
    const userRecord = await convex.query(api.users.getUserById, { id: user.userId as any });

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user (this will cascade delete related data in our deleteUser mutation)
  await convex.mutation(api.users.deleteUser, { authToken, id: user.userId as any });

    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Account deletion error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
