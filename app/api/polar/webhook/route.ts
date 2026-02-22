import { NextRequest, NextResponse } from 'next/server';
import { polarConfig } from '@/lib/polar';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { handleAPIError } from '@/lib/api-error-tracking';
import { captureServerEvent, type ServerEventProperties } from '@/lib/analytics-server';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Disable body parsing for webhook route
export const runtime = 'nodejs';

// Store processed webhook IDs to prevent duplicate processing (in-memory cache)
// In production, use Redis or database for distributed systems
const processedWebhooks = new Set<string>();

const logPolarWebhookEvent = (
  event: string,
  properties?: ServerEventProperties,
  distinctId?: string
) => {
  captureServerEvent(`polar_webhook_${event}`, {
    endpoint: '/api/polar/webhook',
    ...properties,
  }, distinctId);
};

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
    // Get raw body as string for signature verification
    const rawBody = await req.text();
    
    logPolarWebhookEvent('request_received');
    
    // Convert Next.js headers to a plain object
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });
    
    logPolarWebhookEvent('headers_received', {
      header_count: Object.keys(headersObj).length,
      has_signature: Boolean(headersObj['webhook-signature']),
      has_timestamp: Boolean(headersObj['webhook-timestamp']),
    });

    // Verify webhook signature using Polar's SDK
    const webhookSecret = polarConfig.webhookSecret;
    
    if (!webhookSecret) {
      console.error('[Webhook] POLAR_WEBHOOK_SECRET not configured');
      return handleAPIError(
        new Error('Webhook secret not configured'),
        req,
        '/api/polar/webhook',
        'POST',
        500
      );
    }

    let event: any;
    try {
      // Use Polar's validateEvent to verify the webhook
      // Pass the headers object directly - the SDK will look for webhook-signature and webhook-timestamp
      event = validateEvent(rawBody, headersObj, webhookSecret);
      
      logPolarWebhookEvent('signature_verified');
    } catch (error) {
      console.error('[Webhook] Signature validation failed:', error);
      console.error('[Webhook] Error details:', error instanceof Error ? error.message : String(error));
      
      if (error instanceof WebhookVerificationError) {        
        // TEMPORARY: Parse body anyway for debugging (REMOVE IN PRODUCTION)
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Webhook] DEV MODE: Processing despite signature failure');
          try {
            event = JSON.parse(rawBody);
            logPolarWebhookEvent('dev_mode_event_parsed', {
              event_type: event.type,
            });
          } catch (parseError) {
            console.error('[Webhook] DEV MODE: Failed to parse body:', parseError);
            return handleAPIError(
              new Error('Invalid webhook signature and unable to parse body'),
              req,
              '/api/polar/webhook',
              'POST',
              403
            );
          }
        } else {
          return handleAPIError(
            new Error('Invalid webhook signature'),
            req,
            '/api/polar/webhook',
            'POST',
            403
          );
        }
      } else {
        throw error;
      }
    }

    // Extract webhook metadata from validated event
    const eventType = event.type;
    const data = event.data;
    webhookId = event.id || `${eventType}_${Date.now()}`;

    logPolarWebhookEvent('event_received', {
      event_type: eventType,
      webhook_id_present: Boolean(webhookId),
    });

    // Check for duplicate webhook processing (idempotency)
    if (webhookId && processedWebhooks.has(webhookId)) {
      logPolarWebhookEvent('duplicate_webhook', {
        webhook_id_present: true,
      });
      return NextResponse.json({ received: true, duplicate: true }, { headers });
    }

    // Handle different event types
    switch (eventType) {
      case 'checkout.created':
        logPolarWebhookEvent('checkout_created', {
          webhook_id_present: Boolean(webhookId),
        });
        await handleCheckoutCreated(data);
        break;

      case 'checkout.updated':
        logPolarWebhookEvent('checkout_updated', {
          webhook_id_present: Boolean(webhookId),
          status: data.status,
        });
        if (data.status === 'confirmed' || data.status === 'succeeded') {
          await handleCheckoutSuccess(data);
        }
        break;

      case 'subscription.created':
        logPolarWebhookEvent('subscription_created', {
          webhook_id_present: Boolean(webhookId),
        });
        await handleSubscriptionCreated(data);
        break;

      case 'subscription.updated':
        logPolarWebhookEvent('subscription_updated', {
          webhook_id_present: Boolean(webhookId),
          status: data.status,
        });
        await handleSubscriptionUpdated(data);
        break;

      case 'subscription.active':
        logPolarWebhookEvent('subscription_active', {
          webhook_id_present: Boolean(webhookId),
        });
        await handleSubscriptionActive(data);
        break;

      case 'subscription.canceled':
        logPolarWebhookEvent('subscription_canceled', {
          webhook_id_present: Boolean(webhookId),
        });
        await handleSubscriptionCanceled(data);
        break;

      case 'subscription.uncanceled':
        logPolarWebhookEvent('subscription_uncanceled', {
          webhook_id_present: Boolean(webhookId),
        });
        await handleSubscriptionUncanceled(data);
        break;

      case 'subscription.revoked':
        logPolarWebhookEvent('subscription_revoked', {
          webhook_id_present: Boolean(webhookId),
        });
        await handleSubscriptionRevoked(data);
        break;

      case 'order.created':
        logPolarWebhookEvent('order_created', {
          webhook_id_present: Boolean(webhookId),
        });
        await handleOrderCreated(data);
        break;

      default:
        logPolarWebhookEvent('unhandled_event_type', {
          event_type: eventType,
        });
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
    handleAPIError(error, req, '/api/polar/webhook', 'POST', 500);
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
    logPolarWebhookEvent('checkout_started', {}, userId);
    // Could track this in analytics
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutSuccess(data: any) {
  const customerId = data.customer_id || data.customer?.id;
  const customerEmail = data.customer_email || data.customer?.email;
  const embeddedUserId = data.custom_field_data?.userId || data.customFieldData?.userId || data.metadata?.userId;
  
  logPolarWebhookEvent('checkout_success', {
    has_customer_id: Boolean(customerId),
    has_customer_email: Boolean(customerEmail),
    has_embedded_user_id: Boolean(embeddedUserId),
  });

  // Prefer explicit userId we injected at checkout creation time.
  let userId: string | null = embeddedUserId || null;

  // Fallback: Try to find user by customer ID first
  if (!userId) {
    userId = customerId ? await findUserByCustomerId(customerId) : null;
  }

  // Fallback: If not found and we have an email, try to find by email
  if (!userId && customerEmail) {
    logPolarWebhookEvent('checkout_lookup_by_email');
    userId = await findUserByEmail(customerEmail);
  }

  if (!userId) {
    console.warn('No userId found for checkout - cannot update polarCustomerId');
    return;
  }

  // Update user with Polar customer ID for future reference
  try {
    const cronSecret = process.env.CONVEX_CRON_SECRET;
    if (!cronSecret) {
      console.error('[Webhook] CONVEX_CRON_SECRET not configured; cannot update user');
      return;
    }
    await convex.mutation(api.users.updateUser, {
      id: userId as Id<'users'>,
      polarCustomerId: customerId,
    });

    logPolarWebhookEvent('customer_id_stored', {
      has_customer_id: Boolean(customerId),
    }, userId);
  } catch (error) {
    console.error('Failed to update user with customer ID:', error);
  }
}

/**
 * Handle new subscription creation
 */
async function handleSubscriptionCreated(data: any) {
  const customerId = data.customer_id || data.customer?.id;
  const status = data.status;

  const embeddedUserId = data.custom_field_data?.userId || data.customFieldData?.userId || data.metadata?.userId;

  // Try multiple ways to find the user
  let userId: string | null = embeddedUserId || null;
  if (!userId) {
    userId = customerId ? await findUserByCustomerId(customerId) : null;
  }
  
  if (!userId) {
    console.warn('Could not find user for subscription creation');
    return;
  }

  logPolarWebhookEvent('subscription_created_for_user', {
    status,
  }, userId);

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
  const userId =
    data.custom_field_data?.userId ||
    data.customFieldData?.userId ||
    data.metadata?.userId ||
    (customerId ? await findUserByCustomerId(customerId) : null);

  if (!userId) {
    console.warn('Could not find user for active subscription');
    return;
  }

  logPolarWebhookEvent('subscription_activated_for_user', {}, userId);
  await grantPaidRole(userId);
}

/**
 * Handle subscription uncanceled (cancellation reversed)
 */
async function handleSubscriptionUncanceled(data: any) {
  const customerId = data.customer_id;
  const userId =
    data.custom_field_data?.userId ||
    data.customFieldData?.userId ||
    data.metadata?.userId ||
    (customerId ? await findUserByCustomerId(customerId) : null);

  if (!userId) {
    console.warn('Could not find user for uncanceled subscription');
    return;
  }

  logPolarWebhookEvent('subscription_uncanceled_for_user', {}, userId);
  await grantPaidRole(userId);
}

/**
 * Handle subscription revoked (forced cancellation due to non-payment, fraud, etc.)
 */
async function handleSubscriptionRevoked(data: any) {
  const customerId = data.customer_id;
  const userId =
    data.custom_field_data?.userId ||
    data.customFieldData?.userId ||
    data.metadata?.userId ||
    (customerId ? await findUserByCustomerId(customerId) : null);

  if (!userId) {
    console.warn('Could not find user for revoked subscription');
    return;
  }

  logPolarWebhookEvent('subscription_revoked_for_user', {}, userId);
  await revokePaidRole(userId);
}

/**
 * Handle subscription status updates
 */
async function handleSubscriptionUpdated(data: any) {
  const status = data.status;
  const customerId = data.customer_id || data.customer?.id;
  const userId = customerId
    ? (data.custom_field_data?.userId ||
        data.customFieldData?.userId ||
        data.metadata?.userId ||
        await findUserByCustomerId(customerId))
    : (data.custom_field_data?.userId || data.customFieldData?.userId || data.metadata?.userId || null);

  if (!userId) {
    console.warn('Could not find user for subscription update');
    return;
  }

  logPolarWebhookEvent('subscription_updated_for_user', {
    status,
  }, userId);

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
  const customerId = data.customer_id || data.customer?.id;
  const userId = customerId
    ? (data.custom_field_data?.userId ||
        data.customFieldData?.userId ||
        data.metadata?.userId ||
        await findUserByCustomerId(customerId))
    : (data.custom_field_data?.userId || data.customFieldData?.userId || data.metadata?.userId || null);

  if (!userId) {
    console.warn('Could not find user for subscription cancellation');
    return;
  }

  logPolarWebhookEvent('subscription_canceled_for_user', {}, userId);
  await revokePaidRole(userId);
}

/**
 * Handle one-time order creation (order.created event fires when payment succeeds)
 */
async function handleOrderCreated(data: any) {
  logPolarWebhookEvent('order_created_payload', {
    has_customer_id: Boolean(data.customer_id || data.customer?.id),
    has_customer_email: Boolean(data.customer?.email || data.user?.email),
    has_embedded_user_id: Boolean(data.custom_field_data?.userId || data.customFieldData?.userId || data.metadata?.userId),
  });
  
  const embeddedUserId = data.custom_field_data?.userId || data.customFieldData?.userId || data.metadata?.userId;
  const customerId = data.customer_id || data.customer?.id;
  const customerEmail = data.customer?.email || data.user?.email;
  
  logPolarWebhookEvent('order_created', {
    has_customer_id: Boolean(customerId),
    has_customer_email: Boolean(customerEmail),
    has_embedded_user_id: Boolean(embeddedUserId),
  });
  
  // Prefer explicit userId we injected at checkout creation time.
  let userId: string | null = embeddedUserId || null;

  // Fallback: try to find user by customer ID
  if (!userId) {
    userId = customerId ? await findUserByCustomerId(customerId) : null;
  }
  
  // If not found and we have an email, try to find by email
  if (!userId && customerEmail) {
    logPolarWebhookEvent('order_lookup_by_email');
    userId = await findUserByEmail(customerEmail);
    
    // If found, update the user with the Polar customer ID
    if (userId) {
      logPolarWebhookEvent('order_email_match_found', {}, userId);
      try {
        const cronSecret = process.env.CONVEX_CRON_SECRET;
        if (!cronSecret) {
          console.error('[Webhook] CONVEX_CRON_SECRET not configured; cannot update user (order.created)');
          return;
        }
        await convex.mutation(api.users.updateUser, {
          id: userId as Id<'users'>,
          polarCustomerId: customerId,
        });
        logPolarWebhookEvent('order_customer_id_stored', {
          has_customer_id: Boolean(customerId),
        }, userId);
      } catch (error) {
        console.error('Failed to update user with customer ID:', error);
      }
    }
  }

  if (!userId) {
    console.warn('Could not find user for order - no matching customer ID or email');
    return;
  }

  logPolarWebhookEvent('order_created_for_user', {}, userId);
  
  // For one-time purchases and subscriptions, grant paid role
  await grantPaidRole(userId);
}

/**
 * Find user by email address
 */
async function findUserByEmail(email: string): Promise<string | null> {
  try {
    const user = await convex.query(api.users.getUserByEmail, {
      email: email,
    });

    return user?._id || null;
  } catch (error) {
    console.error('Failed to find user by email:', error);
    return null;
  }
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
    const cronSecret = process.env.CONVEX_CRON_SECRET;
    if (!cronSecret) {
      console.error('[Webhook] CONVEX_CRON_SECRET not configured; cannot grant paid role');
      return;
    }
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
        cronSecret,
      });

      logPolarWebhookEvent('paid_role_granted', {}, userId);
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
    const cronSecret = process.env.CONVEX_CRON_SECRET;
    if (!cronSecret) {
      console.error('[Webhook] CONVEX_CRON_SECRET not configured; cannot revoke paid role');
      return;
    }
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
        cronSecret,
      });

      logPolarWebhookEvent('paid_role_revoked', {}, userId);
    }
  } catch (error) {
    console.error('Failed to revoke paid role:', error);
  }
}
