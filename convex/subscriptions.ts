"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { trackServerLog } from "../lib/analytics-server";

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL;
    const cronSecret = process.env.CONVEX_CRON_SECRET;
    
    if (!baseUrl) {
      trackServerLog('subscription_validation_missing_base_url');
      return {
        success: false,
        message: 'No base URL configured. Set NEXT_PUBLIC_APP_URL or SITE_URL.',
      };
    }

    if (!cronSecret) {
      trackServerLog('subscription_validation_missing_cron_secret');
      return {
        success: false,
        message: 'No cron secret configured. Set CONVEX_CRON_SECRET.',
      };
    }

    const url = `${baseUrl}/api/polar/validate-subscriptions`;
    
    trackServerLog('subscription_validation_calling', {
      url,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Convex-Cron-Secret': cronSecret,
        },
      });

      const raw = await response.text();
      let data: any;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = null;
      }

      if (!response.ok) {
        trackServerLog('subscription_validation_api_error', {
          status: response.status,
          has_data: Boolean(data),
        });
        return {
          success: false,
          message:
            (data && (data.error || data.message))
              ? (data.error || data.message)
              : `HTTP ${response.status}: ${raw.slice(0, 180)}`,
        };
      }

      if (!data) {
        return {
          success: false,
          message: `Invalid JSON from ${url}: ${raw.slice(0, 180)}`,
        };
      }

      trackServerLog('subscription_validation_result', {
        has_data: Boolean(data),
        processed: data?.processed,
        revoked: data?.revoked,
      });
      
      return {
        success: true,
        message: data.message || 'Validation complete',
        processed: data.processed,
        revoked: data.revoked,
      };
    } catch (error) {
      trackServerLog('subscription_validation_fetch_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
