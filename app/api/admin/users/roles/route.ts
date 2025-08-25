import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

export async function POST(req: NextRequest) {
  // Ensure requester is an admin (DB-validated)
  const forbidden = await requireAdmin(req);
  if (forbidden) return forbidden;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, roles } = body || {};
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

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

  try {
    const convex = getConvexClient();
    await convex.mutation(api.users.updateUser, { id: userId, roles: nextRoles });
    return NextResponse.json({ ok: true, roles: nextRoles ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Update failed" }, { status: 500 });
  }
}
