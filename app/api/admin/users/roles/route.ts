import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { handleAPIError } from "@/lib/api-error-tracking";

export async function POST(req: NextRequest) {
  // Ensure requester is an admin (DB-validated)
  const forbidden = await requireAdmin(req);
  if (forbidden) return forbidden;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return handleAPIError(
      new Error("Invalid JSON"),
      req,
      "/api/admin/users/roles",
      "POST",
      400
    );
  }

  const { userId, roles } = body || {};
  if (!userId) {
    return handleAPIError(
      new Error("userId is required"),
      req,
      "/api/admin/users/roles",
      "POST",
      400
    );
  }

  try {
    // Accept either array of strings or a single string to set
    let nextRoles: string[] | undefined = undefined;
    if (Array.isArray(roles)) {
      nextRoles = roles
        .filter((r) => typeof r === "string")
        .map((r) => r.trim().toLowerCase())
        .filter((r) => r.length > 0);
      // Dedupe
      nextRoles = Array.from(new Set(nextRoles));
    } else if (typeof roles === "string") {
      const r = roles.trim().toLowerCase();
      nextRoles = r ? [r] : [];
    }

    const convex = getConvexClient();
    await convex.mutation(api.users.updateUser, { id: userId, roles: nextRoles });
    return NextResponse.json({ ok: true, roles: nextRoles ?? null });
  } catch (error) {
    return handleAPIError(error, req, "/api/admin/users/roles", "POST", 500);
  }
}
