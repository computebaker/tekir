import { Polar } from '@polar-sh/sdk';
import { captureServerEvent, type ServerEventProperties } from '@/lib/analytics-server';

/**
 * Polar.sh client for subscription and payment management
 * Docs: https://docs.polar.sh
 */
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || '',
});

/**
 * Configuration for Polar.sh integration
 */
export const polarConfig = {
  organization: process.env.NEXT_PUBLIC_POLAR_ORGANIZATION || '',
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET || '',
};

const logPolarEvent = (event: string, properties?: ServerEventProperties) => {
  captureServerEvent(`polar_${event}`, properties);
};

/**
 * Create a checkout session for a user
 * 
 * Usage:
 * 1. Create a product in Polar dashboard
 * 2. Get the product ID (or product price ID)
 * 3. Call this function with the product ID
 */
export async function createCheckoutSession({
  productId,
  successUrl,
  customerEmail,
  userId,
}: {
  productId: string;
  successUrl: string;
  customerEmail?: string;
  userId?: string;
}) {
  try {
    // Polar expects a products array with product price IDs
    const checkout = await polar.checkouts.create({
      products: [productId], // Product price ID in an array
      successUrl,
      customerEmail,
      // Store user ID in custom field data for webhook processing
      customFieldData: userId ? { userId } : undefined,
    });

    return {
      success: true,
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    };
  } catch (error) {
    console.error('Failed to create Polar checkout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a customer portal session so users can manage their subscription without re-verifying email
 */
export async function createCustomerPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl?: string;
}) {
  try {
    const session = await polar.customerSessions.create({
      customerId,
      ...(returnUrl ? { returnUrl } : {}),
    });

    return {
      success: true,
      portalUrl: session.customerPortalUrl,
      expiresAt: session.expiresAt,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Failed to create Polar customer portal session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get customer subscriptions
 * 
 * Note: The SDK returns paginated results with a result.items array structure.
 */
export async function getCustomerSubscriptions(customerId: string) {
  try {
    logPolarEvent('fetching_subscriptions');
    const result = await polar.subscriptions.list({
      customerId,
    });

    const subscriptions: any[] = [];
    
    // The result is a paginated response - iterate through pages
    // Each page has a 'result' property containing 'items'
    for await (const page of result) {
      const items = (page as any).result?.items || (page as any).items;
      
      if (items && Array.isArray(items)) {
        for (const subscription of items) {
          logPolarEvent('subscription_found', {
            subscription_status: subscription.status,
          });
          subscriptions.push(subscription);
        }
      } else {
        // If page structure is different, log for debugging
        logPolarEvent('unexpected_page_structure', {
          page_keys: Object.keys(page).join(','),
        });
      }
    }

    // Filter for active or trialing subscriptions
    const activeSubscriptions = subscriptions.filter(
      (s: any) => s.status === 'active' || s.status === 'trialing'
    );
    
    logPolarEvent('subscriptions_filtered', {
      active_subscriptions_count: activeSubscriptions.length,
      total_subscriptions_count: subscriptions.length,
    });

    const statusCounts = subscriptions.reduce<Record<string, number>>(
      (acc, subscription: any) => {
        const status = String(subscription.status || 'unknown');
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {}
    );
    logPolarEvent('subscription_status_counts', {
      status_counts: JSON.stringify(statusCounts),
    });

    return {
      success: true,
      subscriptions: activeSubscriptions,
    };
  } catch (error) {
    console.error('[Polar] Failed to get subscriptions:', error);
    return {
      success: false,
      subscriptions: [],
    };
  }
}

/**
 * Get a checkout by ID to verify completion
 */
export async function getCheckout(checkoutId: string) {
  try {
    const checkout = await polar.checkouts.get({
      id: checkoutId,
    });

    return {
      success: true,
      checkout,
    };
  } catch (error) {
    console.error('Failed to get checkout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  try {
    // Mark subscription for cancellation at period end
    const result = await polar.subscriptions.update({
      id: subscriptionId,
      subscriptionUpdate: {
        cancelAtPeriodEnd: true,
      } as any, // SDK types may not be up to date
    });

    return { success: true, subscription: result };
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
