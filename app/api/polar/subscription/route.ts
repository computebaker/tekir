import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSubscriptions } from '@/lib/polar';
import { getJWTUser } from '@/lib/jwt-auth';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * API endpoint to get user's Polar subscription details
 * 
 * GET /api/polar/subscription
 * Returns subscription info including status, next billing date, etc.
 */
export async function GET(req: NextRequest) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  try {
    // Get authenticated user
    const jwtUser = await getJWTUser(req);
    
    if (!jwtUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers }
      );
    }

    // Get user from Convex to find polarCustomerId
    const user = await convex.query(api.users.getUserById, {
      id: jwtUser.userId as Id<'users'>,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }

    console.log(`[Subscription API] User ${user._id} found:`, {
      email: user.email,
      roles: user.roles,
      polarCustomerId: user.polarCustomerId,
      hasPaidRole: user.roles?.some((role: string) => role.toLowerCase() === 'paid')
    });

    // Check if user has polarCustomerId
    if (!user.polarCustomerId) {
      console.log(`[Subscription API] User ${user._id} has no polarCustomerId`);
      return NextResponse.json(
        { 
          hasSubscription: false,
          message: 'No subscription found'
        },
        { headers }
      );
    }

    console.log(`[Subscription API] User ${user._id} has polarCustomerId: ${user.polarCustomerId}`);

    // Fetch subscriptions from Polar
    const result = await getCustomerSubscriptions(user.polarCustomerId);

    if (!result.success) {
      console.error(`[Subscription API] Failed to fetch subscriptions for customer ${user.polarCustomerId}:`, result);
      return NextResponse.json(
        { error: 'Failed to fetch subscription details' },
        { status: 500, headers }
      );
    }

    console.log(`[Subscription API] Found ${result.subscriptions.length} active subscriptions for customer ${user.polarCustomerId}`);
    if (result.subscriptions.length > 0) {
      console.log(`[Subscription API] First subscription:`, result.subscriptions[0]);
    }

    // Return subscription data
    if (result.subscriptions.length === 0) {
      return NextResponse.json(
        { 
          hasSubscription: false,
          message: 'No active subscription found'
        },
        { headers }
      );
    }

    // Return the first active subscription
    const subscription = result.subscriptions[0];

    return NextResponse.json(
      {
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          product: subscription.product,
          price: subscription.price,
        },
      },
      { headers }
    );
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}
