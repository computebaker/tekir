import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';

export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    
    if (!authToken) {
      return NextResponse.json({ authenticated: false });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    
    try {
      const decoded = jwt.verify(authToken, jwtSecret) as any;
      
      // Fetch the latest user data from Convex database
      const convex = getConvexClient();
      const user = await convex.query(api.users.getUserById, { id: decoded.userId });
      
      if (!user) {
        console.log('JWT verification failed: User not found in database');
        return NextResponse.json({ authenticated: false });
      }
      
      return NextResponse.json({
        authenticated: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          image: user.image, // Include the latest profile picture from DB
          imageType: user.imageType, // Include image type for proper cache busting
          avatar: user.image, // For compatibility
          updatedAt: user.updatedAt, // Include update timestamp for cache busting
          isEmailVerified: !!user.emailVerified // Convert emailVerified timestamp to boolean
        }
      });
    } catch (jwtError) {
      console.log('JWT verification failed:', jwtError);
      return NextResponse.json({ authenticated: false });
    }
  } catch (error) {
    console.error('Verify JWT error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
