import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/polar';
import { getJWTUser } from '@/lib/jwt-auth';

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
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400, headers }
      );
    }

    // Create checkout session
    const successUrl = `${req.nextUrl.origin}/settings/account?upgrade=success`;
    
    const result = await createCheckoutSession({
      productId,
      successUrl,
      customerEmail: user.email,
      userId: user.userId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create checkout' },
        { status: 500, headers }
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
    console.error('Checkout creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}
