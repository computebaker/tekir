import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSubscriptions } from '@/lib/polar';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Internal API endpoint to validate Plus subscriptions
 * Called daily by a Convex cron job to ensure subscription status is in sync
 * 
 * This endpoint:
 * 1. Fetches all users with the 'paid' role
 * 2. For each user, checks their Polar subscription status
 * 3. Removes the 'paid' role if subscription is no longer active
 * 
 * POST /api/polar/validate-subscriptions
 * 
 * Headers:
 * - X-Convex-Cron-Secret: Secret key to authenticate cron requests
 */
export async function POST(req: NextRequest) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  try {
    // Verify the request is from our Convex cron job
    const cronSecret = req.headers.get('X-Convex-Cron-Secret');
    const expectedSecret = process.env.CONVEX_CRON_SECRET;

    if (!expectedSecret || cronSecret !== expectedSecret) {
      console.error('[Polar Validation] Invalid or missing cron secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers }
      );
    }

    console.log('[Polar Validation] Starting subscription validation...');

    // Get all users with 'paid' role
    const paidUsers = await convex.query(api.users.listPaidUsers, {});

    if (!paidUsers || paidUsers.length === 0) {
      console.log('[Polar Validation] No paid users found');
      return NextResponse.json(
        { 
          success: true, 
          message: 'No paid users to validate',
          processed: 0,
          revoked: 0,
        },
        { headers }
      );
    }

    console.log(`[Polar Validation] Found ${paidUsers.length} paid users to validate`);

    let processed = 0;
    let revoked = 0;
    const errors: string[] = [];

    for (const user of paidUsers) {
      processed++;
      
      // Skip users without a Polar customer ID - they might have been granted access manually
      if (!user.polarCustomerId) {
        console.log(`[Polar Validation] User ${user._id} has no polarCustomerId, skipping`);
        continue;
      }

      try {
        // Check subscription status with Polar
        const result = await getCustomerSubscriptions(user.polarCustomerId);

        if (!result.success) {
          console.error(`[Polar Validation] Failed to fetch subscriptions for user ${user._id}: API error`);
          errors.push(`User ${user._id}: API error`);
          continue;
        }

        const hasActiveSubscription = result.subscriptions.length > 0;

        if (!hasActiveSubscription) {
          console.log(`[Polar Validation] User ${user._id} has no active subscription, revoking paid role`);
          
          // Revoke the paid role
          const currentRoles = user.roles || [];
          const newRoles = currentRoles.filter(
            (r: string) => r.toLowerCase() !== 'paid'
          );

          if (newRoles.length !== currentRoles.length) {
            await convex.mutation(api.users.updateUserRoles, {
              id: user._id as Id<'users'>,
              roles: newRoles,
            });
            
            revoked++;
            console.log(`[Polar Validation] Revoked paid role from user ${user._id}`);
          }
        } else {
          console.log(`[Polar Validation] User ${user._id} has active subscription (status: ${result.subscriptions[0].status})`);
        }
      } catch (error) {
        console.error(`[Polar Validation] Error processing user ${user._id}:`, error);
        errors.push(`User ${user._id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Add small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[Polar Validation] Complete. Processed: ${processed}, Revoked: ${revoked}, Errors: ${errors.length}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Subscription validation complete',
        processed,
        revoked,
        errors: errors.length > 0 ? errors : undefined,
      },
      { headers }
    );
  } catch (error) {
    console.error('[Polar Validation] Fatal error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers }
    );
  }
}
