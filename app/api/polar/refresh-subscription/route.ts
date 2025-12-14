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
    for await (const page of result) {
      const items = (page as any).result?.items || (page as any).items || [];
      if (Array.isArray(items)) customers.push(...items);
    }
  } catch {
    return null;
  }

  const first = customers[0];
  return first?.id ?? null;
}

async function hasActiveSubscription(customerId: string): Promise<boolean> {
  const active: any[] = [];
  try {
    const result: any = await (polar as any).subscriptions.list({ customerId });
    for await (const page of result) {
      const items = (page as any).result?.items || (page as any).items || [];
      if (Array.isArray(items)) active.push(...items);
    }
  } catch {
    return false;
  }

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

    if (!customerId) {
      customerId = await getCustomerIdByEmail(user.email);
      if (customerId) {
        await convex.mutation(api.users.updateUser, {
          id: user._id as Id<"users">,
          polarCustomerId: customerId,
          cronSecret,
        });
        updatedPolarCustomerId = true;
      }
    }

    if (!customerId) {
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

    if (!active) {
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
      await convex.mutation(api.users.updateUserRoles, {
        id: user._id as Id<"users">,
        roles: [...currentRoles, "paid"],
        cronSecret,
      });
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
    return NextResponse.json<RefreshResult>(
      { ok: false, message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers }
    );
  }
}
