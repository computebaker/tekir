"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

/**
 * Internal action to validate Plus subscriptions
 * 
 * This action calls the /api/polar/validate-subscriptions endpoint
 * to verify all paid users still have active subscriptions in Polar.
 * 
 * If a user's subscription has expired or been canceled, their 'paid' role
 * will be removed.
 * 
 * This is scheduled to run daily via a cron job.
 */
export const validateSubscriptions = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    processed: v.optional(v.number()),
    revoked: v.optional(v.number()),
  }),
  handler: async () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.CONVEX_SITE_URL;
    const cronSecret = process.env.CONVEX_CRON_SECRET;
    
    if (!baseUrl) {
      console.error('[Subscription Validation] No base URL configured');
      return {
        success: false,
        message: 'No base URL configured. Set NEXT_PUBLIC_APP_URL or CONVEX_SITE_URL.',
      };
    }

    if (!cronSecret) {
      console.error('[Subscription Validation] No cron secret configured');
      return {
        success: false,
        message: 'No cron secret configured. Set CONVEX_CRON_SECRET.',
      };
    }

    const url = `${baseUrl}/api/polar/validate-subscriptions`;
    
    console.log(`[Subscription Validation] Calling ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Convex-Cron-Secret': cronSecret,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[Subscription Validation] API error:', data);
        return {
          success: false,
          message: data.error || `HTTP ${response.status}`,
        };
      }

      console.log('[Subscription Validation] Result:', data);
      
      return {
        success: true,
        message: data.message || 'Validation complete',
        processed: data.processed,
        revoked: data.revoked,
      };
    } catch (error) {
      console.error('[Subscription Validation] Fetch error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
