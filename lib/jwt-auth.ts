import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

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

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    
    const decoded = jwt.verify(authToken, jwtSecret) as any;
    
    return {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      name: decoded.name,
      roles: Array.isArray(decoded.roles) ? decoded.roles : []
    };
  } catch (error) {
    console.log('JWT verification failed:', error);
    return null;
  }
}
