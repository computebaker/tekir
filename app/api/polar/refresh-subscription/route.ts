import { NextRequest, NextResponse } from "next/server";
import { getJWTUser } from "@/lib/jwt-auth";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { polar } from "@/lib/polar";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
    console.info("[polar.refresh-subscription] customers.list(email) result shape", {
      isAsyncIterable: !!(result && typeof result[Symbol.asyncIterator] === "function"),
      keys: result ? Object.keys(result) : [],
    });
    // Some SDK versions return an async iterable, others return a single page object.
    if (result && typeof result[Symbol.asyncIterator] === "function") {
      for await (const page of result) {
        const items = (page as any).result?.items || (page as any).items || [];
        console.info("[polar.refresh-subscription] customers.list page shape", {
          keys: page ? Object.keys(page) : [],
          itemCount: Array.isArray(items) ? items.length : 0,
        });
        if (Array.isArray(items)) customers.push(...items);
      }
    } else {
      const items = (result as any)?.result?.items || (result as any)?.items || [];
      console.info("[polar.refresh-subscription] customers.list single page", {
        itemCount: Array.isArray(items) ? items.length : 0,
      });
      if (Array.isArray(items)) customers.push(...items);
    }
  } catch {
    return null;
  }

  const first = customers[0];
  console.info("[polar.refresh-subscription] customers.list(email) aggregated", {
    customersCount: customers.length,
    foundCustomer: Boolean(first?.id),
  });
  return first?.id ?? null;
}

async function hasActiveSubscription(customerId: string): Promise<boolean> {
  const active: any[] = [];
  try {
    const result: any = await (polar as any).subscriptions.list({ customerId });
    console.info("[polar.refresh-subscription] subscriptions.list result shape", {
      isAsyncIterable: !!(result && typeof result[Symbol.asyncIterator] === "function"),
      keys: result ? Object.keys(result) : [],
    });
    for await (const page of result) {
      const items = (page as any).result?.items || (page as any).items || [];
      console.info("[polar.refresh-subscription] subscriptions.list page", {
        keys: page ? Object.keys(page) : [],
        itemCount: Array.isArray(items) ? items.length : 0,
      });
      if (Array.isArray(items)) active.push(...items);
    }
  } catch {
    return false;
  }

  const statuses = active
    .map((s: any) => s?.status)
    .filter((s: any) => typeof s === "string");
  console.info("[polar.refresh-subscription] subscriptions aggregated", {
    subscriptionsCount: active.length,
    uniqueStatuses: Array.from(new Set(statuses)).slice(0, 10),
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
    console.info("[polar.refresh-subscription] start");
    const jwtUser = await getJWTUser(req);
    if (!jwtUser) {
      return NextResponse.json<RefreshResult>({ ok: false, message: "Authentication required" }, { status: 401, headers });
    }

    const cronSecret = process.env.CONVEX_CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json<RefreshResult>({ ok: false, message: "Server not configured" }, { status: 500, headers });
    }

    const user = await convex.query(api.users.getUserById, {
      id: jwtUser.userId as Id<"users">,
    });

    if (!user) {
      return NextResponse.json<RefreshResult>({ ok: false, message: "User not found" }, { status: 404, headers });
    }

    let customerId: string | null = user.polarCustomerId ?? null;
    let updatedPolarCustomerId = false;

    console.info("[polar.refresh-subscription] loaded user", {
      hasStoredPolarCustomerId: Boolean(customerId),
      hasPaidRole: (user.roles ?? []).some((r: string) => r.toLowerCase() === "paid"),
    });

    if (!customerId) {
      console.info("[polar.refresh-subscription] No stored polarCustomerId; attempting email lookup");
      customerId = await getCustomerIdByEmail(user.email);
      if (customerId) {
        console.info("[polar.refresh-subscription] Email lookup found customer; storing polarCustomerId");
        await convex.mutation(api.users.updateUser, {
          id: user._id as Id<"users">,
          polarCustomerId: customerId,
        });
        updatedPolarCustomerId = true;
      } else {
        console.info("[polar.refresh-subscription] Email lookup returned no customer");
      }
    }

    if (!customerId) {
      console.info("[polar.refresh-subscription] done: no customerId available");
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

    console.info("[polar.refresh-subscription] subscription check complete", {
      foundActiveSubscription: active,
      updatedPolarCustomerId,
    });

    if (!active) {
      console.info("[polar.refresh-subscription] done: no active subscription");
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
      console.info("[polar.refresh-subscription] granting paid role");
      await convex.mutation(api.users.updateUserRoles, {
        id: user._id as Id<"users">,
        roles: [...currentRoles, "paid"],
        cronSecret,
      });
    } else {
      console.info("[polar.refresh-subscription] paid role already present");
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
    return NextResponse.json<RefreshResult>(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers }
    );
  }
}
