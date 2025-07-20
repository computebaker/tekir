import { NextRequest, NextResponse } from "next/server";
import { getJWTUser } from "@/lib/jwt-auth";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

export async function POST(request: NextRequest) {
  try {
    const user = await getJWTUser(request);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { enabled } = await request.json();

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const convex = getConvexClient();

    const updateData: any = { 
      settingsSync: enabled,
    };

    // Clear settings if disabling sync
    if (enabled === false) {
      updateData.settings = null;
    }

    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      ...updateData
    });

    const updatedUser = await convex.query(api.users.getUserById, { id: user.userId as any });

    return NextResponse.json({
      settingsSync: updatedUser?.settingsSync || false,
      settings: updatedUser?.settings || {}
    });
  } catch (error) {
    console.error("Settings sync toggle error:", error);
    
    // Handle case where user doesn't exist in database but session is still valid
    if (error && typeof error === 'object' && 'message' in error && (error as any).message.includes('not found')) {
      return NextResponse.json({ 
        error: "User record not found. Please sign out and sign in again." 
      }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
