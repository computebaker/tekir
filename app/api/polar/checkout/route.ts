import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/polar';
import { getJWTUser } from '@/lib/jwt-auth';
import { handleAPIError } from '@/lib/api-error-tracking';

/**
 * API endpoint to create a Polar.sh checkout session
 * 
 * Usage:
 * POST /api/polar/checkout
 * Body: { productId: string }
 */
export async function POST(req: NextRequest) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  try {
    // Get authenticated user
    const user = await getJWTUser(req);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers }
      );
    }

    // Parse request body
    const body = await req.json();
    const { productId } = body;

    if (!productId) {
      return handleAPIError(
        new Error('Product ID is required'),
        req,
        '/api/polar/checkout',
        'POST',
        400
      );
    }

    // Create checkout session
    const successUrl = `${req.nextUrl.origin}/plus/callback`;
    
    const result = await createCheckoutSession({
      productId,
      successUrl,
      customerEmail: user.email,
      userId: user.userId,
    });

    if (!result.success) {
      return handleAPIError(
        new Error(result.error || 'Failed to create checkout'),
        req,
        '/api/polar/checkout',
        'POST',
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        checkoutUrl: result.checkoutUrl,
        checkoutId: result.checkoutId,
      },
      { headers }
    );
  } catch (error) {
    handleAPIError(error, req, '/api/polar/checkout', 'POST', 500);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}
