import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSubscriptions, polar } from '@/lib/polar';
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

    // Check if user already has paid role - if so, they're all set
    const currentRoles = Array.isArray(convexUser.roles) ? convexUser.roles : [];
    const alreadyHasPaidRole = currentRoles.some(role => role.toLowerCase() === 'paid');

    if (alreadyHasPaidRole) {
      console.log('User already has paid role, verification complete');
      return NextResponse.json(
        {
          success: true,
          message: 'Your subscription is already active!',
          alreadyActive: true,
          subscription: {
            status: 'active',
          },
        },
        { headers }
      );
    }

    let customerId = convexUser.polarCustomerId;

    // If no polarCustomerId, try to find it by searching Polar customers by email
    if (!customerId && convexUser.email) {
      try {
        console.log('Looking up customer by email:', convexUser.email);
        
        // Search for customer by email
        const customersResult = await polar.customers.list({
          email: convexUser.email,
          limit: 1,
        });

        // Get first customer from the result
        const customersList: any[] = [];
        for await (const customer of customersResult) {
          customersList.push(customer);
        }

        if (customersList.length > 0) {
          const customer = customersList[0];
          customerId = customer.id;
          console.log('Found customer ID:', customerId);
          
          // Update user with the found customer ID
          await convex.mutation(api.users.updateUser, {
            id: user.userId as Id<'users'>,
            polarCustomerId: customerId,
          });
        }
      } catch (error) {
        console.error('Failed to search for customer:', error);
      }
    }

    // If still no customer ID found, return retry message
    if (!customerId) {
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
    const subscriptionsResult = await getCustomerSubscriptions(customerId);

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
        
        console.log('Granted paid role to user:', user.userId);
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
      // No active subscription found, but customer exists
      // This might mean payment is still processing
      return NextResponse.json(
        {
          success: false,
          message: 'No active subscription found yet. Your payment may still be processing.',
          needsRetry: true,
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
