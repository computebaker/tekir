import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSubscriptions } from '@/lib/polar';
import { getJWTUser } from '@/lib/jwt-auth';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * API endpoint to check and verify user's subscription status after checkout
 * 
 * Usage:
 * POST /api/polar/verify-checkout
 * 
 * This endpoint checks if the authenticated user now has an active subscription
 * and grants the "paid" role accordingly.
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

    // Get user from Convex
    const convexUser = await convex.query(api.users.getUserById, {
      id: user.userId as Id<'users'>,
    });

    if (!convexUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }

    // Check if user has polarCustomerId (set by webhook)
    if (!convexUser.polarCustomerId) {
      // Webhook might not have processed yet, retry after a short delay
      return NextResponse.json(
        {
          success: false,
          message: 'Subscription is being processed. Please wait a moment and try again.',
          needsRetry: true,
        },
        { headers }
      );
    }

    // Get customer's subscriptions from Polar
    const subscriptionsResult = await getCustomerSubscriptions(convexUser.polarCustomerId);

    if (!subscriptionsResult.success) {
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500, headers }
      );
    }

    // Check if user has active subscription
    const hasActiveSubscription = subscriptionsResult.subscriptions.length > 0;

    if (hasActiveSubscription) {
      // Grant "paid" role if not already present
      const currentRoles = Array.isArray(convexUser.roles) ? convexUser.roles : [];
      const hasPaidRole = currentRoles.some(role => role.toLowerCase() === 'paid');

      if (!hasPaidRole) {
        const updatedRoles = [...currentRoles, 'paid'];
        await convex.mutation(api.users.updateUserRoles, {
          id: user.userId as Id<'users'>,
          roles: updatedRoles,
        });
      }

      return NextResponse.json(
        {
          success: true,
          message: 'Subscription verified and activated successfully!',
          subscription: {
            status: subscriptionsResult.subscriptions[0].status,
            currentPeriodEnd: subscriptionsResult.subscriptions[0].current_period_end,
            product: subscriptionsResult.subscriptions[0].product,
          },
        },
        { headers }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: 'No active subscription found. Please contact support if you believe this is an error.',
        },
        { headers }
      );
    }
  } catch (error) {
    console.error('Checkout verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    );
  }
}
