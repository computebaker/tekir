import { NextRequest, NextResponse } from 'next/server';
import { createCustomerPortalSession } from '@/lib/polar';
import { getJWTUser } from '@/lib/jwt-auth';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { handleAPIError } from '@/lib/api-error-tracking';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * API endpoint to generate a Polar customer portal link
 *
 * POST /api/polar/portal
 */
export async function POST(req: NextRequest) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  try {
    const jwtUser = await getJWTUser(req);

    if (!jwtUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers }
      );
    }

    const user = await convex.query(api.users.getUserById, {
      id: jwtUser.userId as Id<'users'>,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }

    if (!user.polarCustomerId) {
      return handleAPIError(
        new Error('No subscription found for this user'),
        req,
        '/api/polar/portal',
        'POST',
        400
      );
    }

    let body: { returnUrl?: string } = {};

    try {
      body = await req.json();
    } catch (error) {
      // Ignore invalid JSON and fallback to defaults
    }

    const fallbackReturnUrl = `${req.nextUrl.origin}/settings/account`;

    const result = await createCustomerPortalSession({
      customerId: user.polarCustomerId,
      returnUrl: typeof body.returnUrl === 'string' && body.returnUrl.trim().length > 0
        ? body.returnUrl
        : fallbackReturnUrl,
    });

    if (!result.success || !result.portalUrl) {
      return handleAPIError(
        new Error(result.error || 'Failed to create customer portal session'),
        req,
        '/api/polar/portal',
        'POST',
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        portalUrl: result.portalUrl,
        expiresAt: result.expiresAt,
      },
      { headers }
    );
  } catch (error) {
    handleAPIError(error, req, '/api/polar/portal', 'POST', 500);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}
