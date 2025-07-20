import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookie
    const sessionToken = request.cookies.get('session-token')?.value;
    
    if (sessionToken) {
      // Delete session from Convex
      const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });
      
      if (session && session._id) {
        // Add a delete function to sessions.ts if it doesn't exist
        // For now, we'll just let the session expire naturally
        console.log('Session signout for token:', sessionToken);
      }
    }

    // Clear both session and JWT cookies
    const response = NextResponse.json({ success: true });
    
    // Clear session token cookie
    response.cookies.set('session-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    });

    // Clear JWT auth token cookie  
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    });

    console.log('Signout: Cleared both auth-token and session-token cookies');

    return response;

  } catch (error) {
    console.error('Signout error:', error);
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
