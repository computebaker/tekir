import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[Proxy] Request to:', pathname);

  // Check if captcha verification is enabled
  const captchaEnabled = process.env.ENABLE_CAPTCHA === 'true';
  
  // If captcha is disabled, allow all requests through
  if (!captchaEnabled) {
    console.log('[Proxy] Captcha disabled, allowing access');
    return NextResponse.next();
  }

  // Skip middleware for API routes and static files
  if (
    pathname.startsWith('/api/captcha') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('/favicon.ico')
  ) {
    console.log('[Proxy] Skipping excluded path:', pathname);
    return NextResponse.next();
  }

  // Get the verification cookie
  const verificationToken = request.cookies.get('__ribaunt_verification_key')?.value;

  console.log('[Proxy] Has token:', !!verificationToken);

  // If user has a valid token, allow access
  if (verificationToken) {
    try {
      const secret = new TextEncoder().encode(process.env.RIBAUNT_SECRET!);
      if (!process.env.RIBAUNT_SECRET) {
        console.error('[Proxy] RIBAUNT_SECRET not found!');
        throw new Error('RIBAUNT_SECRET not configured');
      }
      
      await jwtVerify(verificationToken, secret);
      console.log('[Proxy] Token valid, allowing access');
      return NextResponse.next();
    } catch (error) {
      console.log('[Proxy] Token invalid, clearing cookie');
      // Token is invalid or expired, clear it and show captcha
      // Fall through to show captcha page
    }
  }

  // No token or invalid token - rewrite to captcha page while keeping the URL
  console.log('[Proxy] No valid token, rewriting to /captcha');
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
