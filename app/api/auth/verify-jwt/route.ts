import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';

// Helper function to get JWT_SECRET with validation
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not configured.');
  }
  return secret;
}

export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    const sessionToken = request.cookies.get('session-token')?.value;

    if (!authToken) {
      return NextResponse.json({ authenticated: false });
    }

    try {
      const decoded = jwt.verify(authToken, getJWTSecret(), { algorithms: ['HS256'] }) as any;

      // Fetch the latest user data from Convex database
      const convex = getConvexClient();
      const user = await convex.query(api.users.getUserById, { id: decoded.userId });

      if (!user) {
        if (process.env.NODE_ENV === 'development') {
          console.log('JWT verification failed: User not found in database');
        }
        return NextResponse.json({ authenticated: false });
      }

      // If a session token exists, verify it's valid and linked to this user
      if (sessionToken) {
        try {
          const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });
          if (!session || !session.isActive || session.expiresAt <= Date.now() || String(session.userId) !== String(user._id)) {
            return NextResponse.json({ authenticated: false });
          }
        } catch (e) {
          return NextResponse.json({ authenticated: false });
        }
      }

      return NextResponse.json({
        authenticated: true,
        token: authToken,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          image: user.image,
          imageType: user.imageType,
          avatar: user.image,
          updatedAt: user.updatedAt,
          isEmailVerified: !!user.emailVerified,
          roles: Array.isArray(user.roles) ? user.roles : []
        }
      });
    } catch (jwtError) {
      if (process.env.NODE_ENV === 'development') {
        console.log('JWT verification failed:', jwtError);
      }
      return NextResponse.json({ authenticated: false });
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Verify JWT error:', error);
    }
    return NextResponse.json({ authenticated: false });
  }
}
