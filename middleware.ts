import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[Middleware] Request to:', pathname);

  // Skip middleware for API routes and static files
  if (
    pathname.startsWith('/api/captcha') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('/favicon.ico')
  ) {
    console.log('[Middleware] Skipping excluded path:', pathname);
    return NextResponse.next();
  }

  // Get the verification cookie
  const verificationToken = request.cookies.get('__ribaunt_verification_key')?.value;

  console.log('[Middleware] Has token:', !!verificationToken);

  // If user has a valid token, allow access
  if (verificationToken) {
    try {
      const secret = new TextEncoder().encode(process.env.RIBAUNT_SECRET!);
      if (!process.env.RIBAUNT_SECRET) {
        console.error('[Middleware] RIBAUNT_SECRET not found!');
        throw new Error('RIBAUNT_SECRET not configured');
      }
      
      await jwtVerify(verificationToken, secret);
      console.log('[Middleware] Token valid, allowing access');
      return NextResponse.next();
    } catch (error) {
      console.log('[Middleware] Token invalid, clearing cookie');
      // Token is invalid or expired, clear it and show captcha
      // Fall through to show captcha page
    }
  }

  // No token or invalid token - rewrite to captcha page while keeping the URL
  console.log('[Middleware] No valid token, rewriting to /captcha');
  const url = request.nextUrl.clone();
  url.pathname = '/captcha';
  url.searchParams.set('returnUrl', pathname);
  
  const response = NextResponse.rewrite(url);
  
  // If token was invalid, delete it
  if (verificationToken) {
    response.cookies.delete('__ribaunt_verification_key');
  }
  
  return response;
}

// Simplified matcher - apply to all routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
};
