import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    console.log('Session-check: Checking for session token...');
    
    // Get session token from cookie instead of Authorization header
    const sessionToken = request.cookies.get('session-token')?.value;
    console.log('Session-check: Found session token:', sessionToken ? 'YES' : 'NO');
    
    if (!sessionToken) {
      console.log('Session-check: No session token found');
      return NextResponse.json({ error: 'No valid session token' }, { status: 401 });
    }

    console.log('Session-check: Querying Convex for session...');
    // Get session from Convex
    const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });
    console.log('Session-check: Found session:', session ? 'YES' : 'NO');
    
    if (!session || !session.userId) {
      console.log('Session-check: Invalid or expired session');
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    console.log('Session-check: Getting user data for ID:', session.userId);
    // Get user data
    const user = await convex.query(api.users.getUserById, { id: session.userId });
    console.log('Session-check: Found user:', user ? 'YES' : 'NO');
    
    if (!user) {
      console.log('Session-check: User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Return user data
    return NextResponse.json({
      id: user._id,
      email: user.email,
      username: user.username,
      name: user.name,
      image: user.image,
      avatar: user.image,
      isEmailVerified: !!user.emailVerified,
      settings: user.settings
    });

  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { error: 'Failed to check session' },
      { status: 500 }
    );
  }
}
