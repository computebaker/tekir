import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      cacheStrategy: { ttl: 60 }, 
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user (this will cascade delete related data based on your schema)
    await prisma.user.delete({
      where: {
        id: session.user.id
      }
    });

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
