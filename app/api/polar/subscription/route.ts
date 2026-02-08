import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSubscriptions } from '@/lib/polar';
import { getJWTUser } from '@/lib/jwt-auth';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { handleAPIError } from '@/lib/api-error-tracking';
import { captureServerEvent, type ServerEventProperties } from '@/lib/analytics-server';

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

  const logPolarEvent = (
    event: string,
    properties?: ServerEventProperties,
    distinctId?: string
  ) => {
    captureServerEvent(`polar_${event}`, {
      endpoint: '/api/polar/subscription',
      ...properties,
    }, distinctId);
  };

  logPolarEvent('subscription_check_request');

  try {
    // Get authenticated user
    const jwtUser = await getJWTUser(req);
    
    if (!jwtUser) {
      logPolarEvent('authentication_required', { user_authenticated: false });
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers }
      );
    }

    logPolarEvent('authenticated_user', { user_authenticated: true }, jwtUser.userId);

    // Get user from Convex to find polarCustomerId
    const user = await convex.query(api.users.getUserById, {
      id: jwtUser.userId as Id<'users'>,
    });

    if (!user) {
      logPolarEvent('user_not_found', { user_authenticated: true }, jwtUser.userId);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }

    const hasPaidRole = user.roles?.some(
      (role: string) => role.toLowerCase() === 'paid'
    ) ?? false;
    logPolarEvent(
      'user_loaded',
      {
        user_authenticated: true,
        has_paid_role: hasPaidRole,
        has_polar_customer_id: Boolean(user.polarCustomerId),
      },
      jwtUser.userId
    );

    // Check if user has polarCustomerId
    if (!user.polarCustomerId) {
      logPolarEvent(
        'missing_polar_customer_id',
        { user_authenticated: true, has_polar_customer_id: false },
        jwtUser.userId
      );
      return NextResponse.json(
        { 
          hasSubscription: false,
          message: 'No subscription found'
        },
        { headers }
      );
    }

    logPolarEvent(
      'fetching_subscriptions',
      { user_authenticated: true, has_polar_customer_id: true },
      jwtUser.userId
    );

    // Fetch subscriptions from Polar
    const result = await getCustomerSubscriptions(user.polarCustomerId);

    if (!result.success) {
      console.error(`[Polar] Failed to fetch subscriptions for customer ${user.polarCustomerId}`);
      return handleAPIError(
        new Error('Failed to fetch subscription details'),
        req,
        '/api/polar/subscription',
        'GET',
        500
      );
    }

    logPolarEvent(
      'subscriptions_fetched',
      { subscriptions_count: result.subscriptions.length },
      jwtUser.userId
    );
    if (result.subscriptions.length > 0) {
      logPolarEvent(
        'subscription_status',
        { subscription_status: result.subscriptions[0].status },
        jwtUser.userId
      );
    }

    // Return subscription data
    if (result.subscriptions.length === 0) {
      logPolarEvent('no_active_subscriptions', {}, jwtUser.userId);
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
    logPolarEvent(
      'returning_subscription',
      { subscription_status: subscription.status },
      jwtUser.userId
    );

    // Helper to safely convert Date to ISO string
    const toISOString = (date: any) => {
      if (!date) return null;
      if (date instanceof Date) return date.toISOString();
      if (typeof date === 'string') return date;
      return null;
    };

    return NextResponse.json(
      {
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: toISOString(subscription.currentPeriodEnd),
          currentPeriodStart: toISOString(subscription.currentPeriodStart),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
          product: {
            id: subscription.product.id,
            name: subscription.product.name,
            description: subscription.product.description,
          },
          prices: subscription.prices,
          amount: subscription.amount,
          currency: subscription.currency,
        },
      },
      { headers }
    );
  } catch (error) {
    console.error(`[Polar] Subscription fetch error:`, error);
    return handleAPIError(error, req, '/api/polar/subscription', 'GET', 500);
  }
}
