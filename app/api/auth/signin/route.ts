import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConvexClient } from '@/lib/convex-client';

export async function POST(req: NextRequest) {
  try {
    const { emailOrUsername, password } = await req.json();

    if (!emailOrUsername || !password) {
      return NextResponse.json(
        { error: 'Email/username and password are required' },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Check if input is email or username
    const isEmail = emailOrUsername.includes('@');
    
    // Get user by email or username
    let user;
    if (isEmail) {
      user = await convex.query(api.users.getUserByEmail, {
        email: emailOrUsername
      });
    } else {
      user = await convex.query(api.users.getUserByUsername, {
        username: emailOrUsername
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in' },
        { status: 403 }
      );
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        username: user.username,
        name: user.name
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Also generate session token for Convex session tracking
    const sessionToken = crypto.randomUUID();
    console.log('Signin: Generated JWT token for user:', user._id);
    console.log('Signin: Generated session token:', sessionToken);

    // Store session in Convex for rate limiting
    console.log('Signin: Storing session for user:', user._id);
    const sessionResult = await convex.mutation(api.sessions.registerSessionToken, {
      sessionToken,
      userId: user._id
    });
    console.log('Signin: Session stored, result:', sessionResult);

    // Set both JWT and session cookies
    const response = NextResponse.json({ 
      success: true, 
      token, // Return JWT token in response
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        username: user.username
      } 
    });

    // Set JWT token as httpOnly cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // Also set session token for rate limiting
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    console.log('Signin: Setting JWT cookie:', token.substring(0, 20) + '...');
    console.log('Signin: Response ready with cookies set');

    return response;
  } catch (error) {
    console.error('Signin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
