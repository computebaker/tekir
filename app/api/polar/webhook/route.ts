import { NextRequest, NextResponse } from 'next/server';
import { polarConfig } from '@/lib/polar';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Disable body parsing for webhook route
export const runtime = 'nodejs';

// Store processed webhook IDs to prevent duplicate processing (in-memory cache)
// In production, use Redis or database for distributed systems
const processedWebhooks = new Set<string>();

/**
 * Polar.sh webhook handler
 * 
 * Handles these webhook events from Polar:
 * - checkout.created: When checkout session is created
 * - checkout.updated: When checkout status changes
 * - subscription.created: New subscription started
 * - subscription.updated: Subscription details changed
 * - subscription.active: Subscription is now active
 * - subscription.canceled: Subscription canceled
 * - subscription.uncanceled: Cancellation was reversed
 * - subscription.revoked: Subscription revoked (non-payment, fraud, etc.)
 * - order.created: One-time purchase completed
 * 
 * Updates user roles in Convex based on subscription status
 */
export async function POST(req: NextRequest) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  let webhookId: string | undefined;

  try {
    // Get raw body as Buffer for signature verification
    const rawBody = await req.text();
    
    console.log('[Webhook] Received webhook request');
    console.log('[Webhook] Headers:', Object.fromEntries(req.headers.entries()));

    // Verify webhook signature using Polar's SDK
    const webhookSecret = polarConfig.webhookSecret;
    
    if (!webhookSecret) {
      console.error('[Webhook] POLAR_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500, headers }
      );
    }

    let event: any;
    try {
      // Use Polar's validateEvent to verify the webhook
      // This function expects the raw body, headers, and secret
      event = validateEvent(rawBody, req.headers as any, webhookSecret);
      
      console.log('[Webhook] Signature verified successfully');
    } catch (error) {
      console.error('[Webhook] Signature validation failed:', error);
      
      if (error instanceof WebhookVerificationError) {
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 403, headers }
        );
      }
      
      throw error;
    }

    // Extract webhook metadata from validated event
    const eventType = event.type;
    const data = event.data;
    webhookId = event.id || `${eventType}_${Date.now()}`;

    console.log(`[Webhook ${webhookId}] Received event: ${eventType}`);

    // Check for duplicate webhook processing (idempotency)
    if (webhookId && processedWebhooks.has(webhookId)) {
      console.log(`[Webhook ${webhookId}] Already processed, skipping`);
      return NextResponse.json({ received: true, duplicate: true }, { headers });
    }

    // Handle different event types
    switch (eventType) {
      case 'checkout.created':
        console.log(`[${webhookId}] Checkout created:`, data.id);
        await handleCheckoutCreated(data);
        break;

      case 'checkout.updated':
        console.log(`[${webhookId}] Checkout updated:`, data.id, 'status:', data.status);
        if (data.status === 'confirmed' || data.status === 'succeeded') {
          await handleCheckoutSuccess(data);
        }
        break;

      case 'subscription.created':
        console.log(`[${webhookId}] Subscription created:`, data.id);
        await handleSubscriptionCreated(data);
        break;

      case 'subscription.updated':
        console.log(`[${webhookId}] Subscription updated:`, data.id, 'status:', data.status);
        await handleSubscriptionUpdated(data);
        break;

      case 'subscription.active':
        console.log(`[${webhookId}] Subscription active:`, data.id);
        await handleSubscriptionActive(data);
        break;

      case 'subscription.canceled':
        console.log(`[${webhookId}] Subscription canceled:`, data.id);
        await handleSubscriptionCanceled(data);
        break;

      case 'subscription.uncanceled':
        console.log(`[${webhookId}] Subscription uncanceled:`, data.id);
        await handleSubscriptionUncanceled(data);
        break;

      case 'subscription.revoked':
        console.log(`[${webhookId}] Subscription revoked:`, data.id);
        await handleSubscriptionRevoked(data);
        break;

      case 'order.created':
        console.log(`[${webhookId}] Order created:`, data.id);
        await handleOrderCreated(data);
        break;

      default:
        console.log(`[${webhookId}] Unhandled event type:`, event);
    }

    // Mark webhook as processed
    if (webhookId) {
      processedWebhooks.add(webhookId);

      // Clean up old webhook IDs (keep last 1000)
      if (processedWebhooks.size > 1000) {
        const toDelete = Array.from(processedWebhooks).slice(0, 100);
        toDelete.forEach(id => processedWebhooks.delete(id));
      }
    }

    return NextResponse.json({ received: true, webhookId }, { headers });
  } catch (error) {
    console.error(`[Webhook ${webhookId}] Processing error:`, error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers }
    );
  }
}

/**
 * Handle checkout creation (can be used for analytics)
 */
async function handleCheckoutCreated(data: any) {
  // Optional: Track checkout creation for funnel analytics
  const userId = data.custom_field_data?.userId || data.metadata?.userId;
  
  if (userId) {
    console.log(`User ${userId} started checkout`);
    // Could track this in analytics
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutSuccess(data: any) {
  const userId = data.custom_field_data?.userId || data.metadata?.userId;
  const customerId = data.customer_id;

  if (!userId) {
    console.warn('No userId in checkout custom_field_data or metadata');
    return;
  }

  // Update user with Polar customer ID for future reference
  try {
    await convex.mutation(api.users.updateUser, {
      id: userId as Id<'users'>,
      polarCustomerId: customerId,
    });

    console.log(`Updated user ${userId} with Polar customer ID: ${customerId}`);
  } catch (error) {
    console.error('Failed to update user with customer ID:', error);
  }
}

/**
 * Handle new subscription creation
 */
async function handleSubscriptionCreated(data: any) {
  const customerId = data.customer_id;
  const status = data.status;
  const userId = data.custom_field_data?.userId || data.metadata?.userId || await findUserByCustomerId(customerId);

  if (!userId) {
    console.warn('Could not find user for subscription creation');
    return;
  }

  console.log(`Subscription created for user ${userId} with status: ${status}`);

  // Grant paid role if subscription is active or trialing
  if (status === 'active' || status === 'trialing') {
    await grantPaidRole(userId);
  }
}

/**
 * Handle subscription becoming active
 */
async function handleSubscriptionActive(data: any) {
  const customerId = data.customer_id;
  const userId = data.custom_field_data?.userId || data.metadata?.userId || await findUserByCustomerId(customerId);

  if (!userId) {
    console.warn('Could not find user for active subscription');
    return;
  }

  console.log(`Subscription activated for user ${userId}`);
  await grantPaidRole(userId);
}

/**
 * Handle subscription uncanceled (cancellation reversed)
 */
async function handleSubscriptionUncanceled(data: any) {
  const customerId = data.customer_id;
  const userId = data.custom_field_data?.userId || data.metadata?.userId || await findUserByCustomerId(customerId);

  if (!userId) {
    console.warn('Could not find user for uncanceled subscription');
    return;
  }

  console.log(`Subscription uncanceled for user ${userId}`);
  await grantPaidRole(userId);
}

/**
 * Handle subscription revoked (forced cancellation due to non-payment, fraud, etc.)
 */
async function handleSubscriptionRevoked(data: any) {
  const customerId = data.customer_id;
  const userId = data.custom_field_data?.userId || data.metadata?.userId || await findUserByCustomerId(customerId);

  if (!userId) {
    console.warn('Could not find user for revoked subscription');
    return;
  }

  console.log(`Subscription revoked for user ${userId}`);
  await revokePaidRole(userId);
}

/**
 * Handle subscription status updates
 */
async function handleSubscriptionUpdated(data: any) {
  const status = data.status;
  const customerId = data.customer_id;
  const userId = data.custom_field_data?.userId || data.metadata?.userId || await findUserByCustomerId(customerId);

  if (!userId) {
    console.warn('Could not find user for subscription update');
    return;
  }

  console.log(`Subscription updated for user ${userId}, new status: ${status}`);

  // Update role based on new status
  // Active states that should grant access
  if (status === 'active' || status === 'trialing') {
    await grantPaidRole(userId);
  } 
  // Inactive states that should revoke access
  else if (status === 'canceled' || status === 'past_due' || status === 'unpaid' || status === 'incomplete' || status === 'incomplete_expired') {
    await revokePaidRole(userId);
  }
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(data: any) {
  const customerId = data.customer_id;
  const userId = data.custom_field_data?.userId || data.metadata?.userId || await findUserByCustomerId(customerId);

  if (!userId) {
    console.warn('Could not find user for subscription cancellation');
    return;
  }

  console.log(`Subscription canceled for user ${userId}`);
  await revokePaidRole(userId);
}

/**
 * Handle one-time order creation (order.created event fires when payment succeeds)
 */
async function handleOrderCreated(data: any) {
  const customerId = data.customer_id;
  const userId = data.custom_field_data?.userId || data.metadata?.userId || await findUserByCustomerId(customerId);

  if (!userId) {
    console.warn('Could not find user for order');
    return;
  }

  console.log(`Order created for user ${userId}`);
  
  // For one-time purchases, grant paid role
  // Note: You might want to track expiration separately for lifetime purchases
  await grantPaidRole(userId);
}

/**
 * Find user by Polar customer ID
 */
async function findUserByCustomerId(customerId: string): Promise<string | null> {
  try {
    // Query Convex for user with this polarCustomerId
    // You'll need to add this query to your Convex functions
    const user = await convex.query(api.users.getUserByPolarCustomerId, {
      polarCustomerId: customerId,
    });

    return user?._id || null;
  } catch (error) {
    console.error('Failed to find user by customer ID:', error);
    return null;
  }
}

/**
 * Grant paid role to user
 */
async function grantPaidRole(userId: string) {
  try {
    // Get current user roles
    const user = await convex.query(api.users.getUserById, {
      id: userId as Id<'users'>,
    });

    if (!user) {
      console.error('User not found:', userId);
      return;
    }

    const currentRoles = user.roles || [];
    const rolesLower = currentRoles.map((r: string) => r.toLowerCase());

    // Add 'paid' role if not already present
    if (!rolesLower.includes('paid')) {
      const newRoles = [...currentRoles, 'paid'];
      
      await convex.mutation(api.users.updateUserRoles, {
        id: userId as Id<'users'>,
        roles: newRoles,
      });

      console.log(`Granted paid role to user ${userId}`);
    }
  } catch (error) {
    console.error('Failed to grant paid role:', error);
  }
}

/**
 * Revoke paid role from user
 */
async function revokePaidRole(userId: string) {
  try {
    const user = await convex.query(api.users.getUserById, {
      id: userId as Id<'users'>,
    });

    if (!user) {
      console.error('User not found:', userId);
      return;
    }

    const currentRoles = user.roles || [];
    const newRoles = currentRoles.filter(
      (r: string) => r.toLowerCase() !== 'paid'
    );

    if (newRoles.length !== currentRoles.length) {
      await convex.mutation(api.users.updateUserRoles, {
        id: userId as Id<'users'>,
        roles: newRoles,
      });

      console.log(`Revoked paid role from user ${userId}`);
    }
  } catch (error) {
    console.error('Failed to revoke paid role:', error);
  }
}
