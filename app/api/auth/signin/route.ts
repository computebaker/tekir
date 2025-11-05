import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { fetchMutation } from 'convex/nextjs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getConvexClient } from '@/lib/convex-client';

export async function POST(req: NextRequest) {
  console.log(`[Auth] Starting signin request`);

  try {
    const { emailOrUsername, password } = await req.json();

    if (!emailOrUsername || !password) {
      console.log(`[Auth] Missing required fields`);
      return NextResponse.json(
        { error: 'Email/username and password are required' },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Check if input is email or username
    const isEmail = emailOrUsername.includes('@');
    console.log(`[Auth] Input type: ${isEmail ? 'email' : 'username'}`);
    
    // Get user by email or username
    let user;
    if (isEmail) {
      console.log(`[Auth] Looking up user by email`);
      user = await convex.query(api.users.getUserByEmail, {
        email: emailOrUsername
      });
    } else {
      console.log(`[Auth] Looking up user by username`);
      user = await convex.query(api.users.getUserByUsername, {
        username: emailOrUsername.toLowerCase()
      });
    }

    if (!user) {
      console.log(`[Auth] User not found`);
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    console.log(`[Auth] User found: id=${user._id}, emailVerified=${!!user.emailVerified}, hasPassword=${!!user.password}`);

    if (!user.password) {
      console.log(`[Auth] User has no password set`);
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    // Verify password
    console.log(`[Auth] Verifying password`);
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log(`[Auth] Password verification failed`);
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 }
      );
    }

    console.log(`[Auth] Password verified successfully`);

    // Check if email is verified
    if (!user.emailVerified) {
      console.log(`[Auth] Email not verified`);
      return NextResponse.json(
        { error: 'Please verify your email before signing in' },
        { status: 403 }
      );
    }

    console.log(`[Auth] Email verified, generating tokens`);

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email, 
        username: user.username,
        name: user.name,
        roles: Array.isArray(user.roles) ? user.roles : []
      },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Also generate session token for Convex session tracking
    console.log(`[Auth] Generating session for user: ${user._id}`);

    // Store session in Convex for rate limiting (will return existing token if user already has one)
    const sessionResult = await convex.mutation(api.sessions.getOrCreateSessionToken, {
      userId: user._id
    });
    console.log(`[Convex] Session result:`, sessionResult);

    const sessionToken = sessionResult.sessionToken;

    console.log(`[Auth] Authentication successful, setting cookies`);

    // Set both JWT and session cookies
    const response = NextResponse.json({ 
      success: true, 
      token, // Return JWT token in response
      user: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
  username: user.username,
  roles: Array.isArray(user.roles) ? user.roles : []
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

    console.log(`[Auth] Signin completed successfully`);

    return response;
  } catch (error) {
    console.error(`[Auth] Signin error:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
