import { Polar } from '@polar-sh/sdk';

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
 * Get customer subscriptions
 */
export async function getCustomerSubscriptions(customerId: string) {
  try {
    console.log(`[Polar] Fetching subscriptions for customer: ${customerId}`);
    const result = await polar.subscriptions.list({
      customerId,
    });

    const subscriptions: any[] = [];
    for await (const subscription of result) {
      console.log(`[Polar] Found subscription:`, {
        id: (subscription as any).id,
        status: (subscription as any).status,
        customer_id: (subscription as any).customer_id,
        current_period_end: (subscription as any).current_period_end,
        cancel_at_period_end: (subscription as any).cancel_at_period_end
      });
      subscriptions.push(subscription);
    }

    const activeSubscriptions = subscriptions.filter((s: any) => s.status === 'active' || s.status === 'trialing');
    console.log(`[Polar] Filtered to ${activeSubscriptions.length} active/trialing subscriptions`);

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
