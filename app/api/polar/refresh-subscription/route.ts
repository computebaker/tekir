import { NextRequest, NextResponse } from "next/server";
import { getJWTUser } from "@/lib/jwt-auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { polar } from "@/lib/polar";
import { handleAPIError } from "@/lib/api-error-tracking";
import { captureServerEvent, type ServerEventProperties } from "@/lib/analytics-server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const logPolarEvent = (
  event: string,
  properties?: ServerEventProperties,
  distinctId?: string
) => {
  captureServerEvent(`polar_refresh_subscription_${event}`, {
    endpoint: '/api/polar/refresh-subscription',
    ...properties,
  }, distinctId);
};

type RefreshResult = {
  ok: true;
  foundActiveSubscription: boolean;
  updatedPolarCustomerId: boolean;
  message?: string;
} | {
  ok: false;
  message: string;
};

async function getCustomerIdByEmail(email: string): Promise<string | null> {
  // Best-effort: query Polar customers by email.
  // SDK pagination shape varies, so we iterate defensively.
  const customers: any[] = [];
  try {
    const result: any = await (polar as any).customers.list({ email });
    logPolarEvent('customers_list_result_shape', {
      is_async_iterable: !!(result && typeof result[Symbol.asyncIterator] === "function"),
      keys: result ? Object.keys(result).join(',') : '',
    });
    // Some SDK versions return an async iterable, others return a single page object.
    if (result && typeof result[Symbol.asyncIterator] === "function") {
      for await (const page of result) {
        const items = (page as any).result?.items || (page as any).items || [];
        logPolarEvent('customers_list_page_shape', {
          keys: page ? Object.keys(page).join(',') : '',
          item_count: Array.isArray(items) ? items.length : 0,
        });
        if (Array.isArray(items)) customers.push(...items);
      }
    } else {
      const items = (result as any)?.result?.items || (result as any)?.items || [];
      logPolarEvent('customers_list_single_page', {
        item_count: Array.isArray(items) ? items.length : 0,
      });
      if (Array.isArray(items)) customers.push(...items);
    }
  } catch {
    return null;
  }

  const first = customers[0];
  logPolarEvent('customers_list_aggregated', {
    customers_count: customers.length,
    found_customer: Boolean(first?.id),
  });
  return first?.id ?? null;
}

async function hasActiveSubscription(customerId: string): Promise<boolean> {
  const active: any[] = [];
  try {
    const result: any = await (polar as any).subscriptions.list({ customerId });
    logPolarEvent('subscriptions_list_result_shape', {
      is_async_iterable: !!(result && typeof result[Symbol.asyncIterator] === "function"),
      keys: result ? Object.keys(result).join(',') : '',
    });
    for await (const page of result) {
      const items = (page as any).result?.items || (page as any).items || [];
      logPolarEvent('subscriptions_list_page', {
        keys: page ? Object.keys(page).join(',') : '',
        item_count: Array.isArray(items) ? items.length : 0,
      });
      if (Array.isArray(items)) active.push(...items);
    }
  } catch {
    return false;
  }

  const statuses = active
    .map((s: any) => s?.status)
    .filter((s: any) => typeof s === "string");
  logPolarEvent('subscriptions_aggregated', {
    subscriptions_count: active.length,
    unique_statuses: Array.from(new Set(statuses)).slice(0, 10).join(','),
  });

  return active.some((s: any) => s?.status === "active" || s?.status === "trialing");
}

/**
 * POST /api/polar/refresh-subscription
 *
 * For signed-in users: tries to discover an active Polar subscription.
 * Strategy:
 * 1) If user has stored polarCustomerId -> check active subscriptions.
 * 2) Else try to find customer by email -> store polarCustomerId -> check subscriptions.
 *
 * If an active subscription is found, it grants the 'paid' role.
 */
export async function POST(req: NextRequest) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
  };

  try {
    logPolarEvent('start');
    const jwtUser = await getJWTUser(req);
    if (!jwtUser) {
      logPolarEvent('authentication_required');
      return handleAPIError(
        new Error("Authentication required"),
        req,
        '/api/polar/refresh-subscription',
        'POST',
        401
      );
    }

    const cronSecret = process.env.CONVEX_CRON_SECRET;
    if (!cronSecret) {
      logPolarEvent('missing_cron_secret');
      return handleAPIError(
        new Error("Server not configured"),
        req,
        '/api/polar/refresh-subscription',
        'POST',
        500
      );
    }

    const user = await convex.query(api.users.getUserById, {
      id: jwtUser.userId as Id<"users">,
    });

    if (!user) {
      logPolarEvent('user_not_found', { user_authenticated: true }, jwtUser.userId);
      return handleAPIError(
        new Error("User not found"),
        req,
        '/api/polar/refresh-subscription',
        'POST',
        404
      );
    }

    let customerId: string | null = user.polarCustomerId ?? null;
    let updatedPolarCustomerId = false;

    logPolarEvent(
      'user_loaded',
      {
        has_stored_polar_customer_id: Boolean(customerId),
        has_paid_role: (user.roles ?? []).some((r: string) => r.toLowerCase() === "paid"),
      },
      jwtUser.userId
    );

    if (!customerId) {
      logPolarEvent('no_stored_customer_id', {}, jwtUser.userId);
      customerId = await getCustomerIdByEmail(user.email);
      if (customerId) {
        logPolarEvent('email_lookup_found_customer', {}, jwtUser.userId);
        await convex.mutation(api.users.updateUser, {
          id: user._id as Id<"users">,
          polarCustomerId: customerId,
        });
        updatedPolarCustomerId = true;
      } else {
        logPolarEvent('email_lookup_no_customer', {}, jwtUser.userId);
      }
    }

    if (!customerId) {
      logPolarEvent('no_customer_id_available', { updated_polar_customer_id: updatedPolarCustomerId }, jwtUser.userId);
      return NextResponse.json<RefreshResult>(
        {
          ok: true,
          foundActiveSubscription: false,
          updatedPolarCustomerId,
        },
        { headers }
      );
    }

    const active = await hasActiveSubscription(customerId);

    logPolarEvent(
      'subscription_check_complete',
      {
        found_active_subscription: active,
        updated_polar_customer_id: updatedPolarCustomerId,
      },
      jwtUser.userId
    );

    if (!active) {
      logPolarEvent('no_active_subscription', {}, jwtUser.userId);
      return NextResponse.json<RefreshResult>(
        {
          ok: true,
          foundActiveSubscription: false,
          updatedPolarCustomerId,
          message: "No active subscription found",
        },
        { headers }
      );
    }

    // Ensure user has paid role
    const currentRoles = user.roles ?? [];
    const hasPaid = currentRoles.some((r: string) => r.toLowerCase() === "paid");
    if (!hasPaid) {
      logPolarEvent('granting_paid_role', {}, jwtUser.userId);
      await convex.mutation(api.users.updateUserRoles, {
        id: user._id as Id<"users">,
        roles: [...currentRoles, "paid"],
        cronSecret,
      });
    } else {
      logPolarEvent('paid_role_already_present', {}, jwtUser.userId);
    }

    return NextResponse.json<RefreshResult>(
      {
        ok: true,
        foundActiveSubscription: true,
        updatedPolarCustomerId,
        message: "Active subscription found and synced",
      },
      { headers }
    );
  } catch (error) {
    console.error("[polar.refresh-subscription] error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    handleAPIError(error, req, '/api/polar/refresh-subscription', 'POST', 500);
    return NextResponse.json<RefreshResult>(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers }
    );
  }
}
