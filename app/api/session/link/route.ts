import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { linkSessionToUser, isConvexConfigured } from '@/lib/convex-session';

export async function POST(req: NextRequest) {
  if (!isConvexConfigured) {
    return NextResponse.json({ success: true, message: "Convex not configured, skipping session linking." });
  }

  try {
    // Check if user is authenticated
    const user = await getJWTUser(req);
    const userId = user?.userId;
    
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
