import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { trackServerLog } from '@/lib/analytics-server';

// Helper function to get JWT_SECRET with validation
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is not configured. Please set it in your .env file or deployment configuration.');
  }
  return secret;
}

export interface JWTUser {
  userId: string;
  email: string;
  username: string;
  name: string;
  roles?: string[];
}

export async function getJWTUser(request: NextRequest): Promise<JWTUser | null> {
  try {
    const authToken = request.cookies.get('auth-token')?.value;

    if (!authToken) {
      return null;
    }

    const JWT_SECRET = getJWTSecret();
    const decoded = jwt.verify(authToken, JWT_SECRET, { algorithms: ['HS256'] }) as any;

    return {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      name: decoded.name,
      roles: Array.isArray(decoded.roles) ? decoded.roles : []
    };
  } catch (error) {
    // Don't log sensitive error details in production
    if (process.env.NODE_ENV === 'development') {
      trackServerLog('jwt_verification_failed', {
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return null;
  }
}
