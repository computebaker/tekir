import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  try {
    // Get session token from cookie instead of Authorization header
    const sessionToken = request.cookies.get('session-token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'No valid session token' }, { status: 401 });
    }

    // Get session from Convex
    const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    // Get user data
    const user = await convex.query(api.users.getUserById, { id: session.userId });

    if (!user) {
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
      settings: user.settings,
      roles: Array.isArray(user.roles) ? user.roles : []
    });

  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Session check error:', error);
    }
    return NextResponse.json(
      { error: 'Failed to check session' },
      { status: 500 }
    );
  }
}
