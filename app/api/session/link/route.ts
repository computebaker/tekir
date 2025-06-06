import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { linkSessionToUser, isRedisConfigured } from '@/lib/redis';

export async function POST(req: NextRequest) {
  if (!isRedisConfigured) {
    return NextResponse.json({ success: true, message: "Redis not configured, skipping session linking." });
  }

  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'User not authenticated.' }, { status: 401 });
    }

    // Get the current session token from cookies
    const sessionToken = req.cookies.get('session-token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'No session token found.' }, { status: 400 });
    }

    // Link the session to the user
    const success = await linkSessionToUser(sessionToken, userId);
    
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to link session to user.' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Session successfully linked to user account.',
      userId: userId,
      newRequestLimit: 1200
    });
  } catch (error) {
    console.error("Error in /api/session/link:", error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
