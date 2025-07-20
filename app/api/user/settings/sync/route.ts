import { NextRequest, NextResponse } from "next/server";
import { getJWTUser } from "@/lib/jwt-auth";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";

export async function GET(request: NextRequest) {
  try {
    const user = await getJWTUser(request);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convex = getConvexClient();

    const userRecord = await convex.query(api.users.getUserById, { id: user.userId as any });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      settingsSync: userRecord.settingsSync,
      settings: userRecord.settings || {}
    });
  } catch (error) {
    console.error("Settings sync GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getJWTUser(request);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { settings } = await request.json();

    const convex = getConvexClient();

    const userRecord = await convex.query(api.users.getUserById, { id: user.userId as any });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!userRecord.settingsSync) {
      return NextResponse.json({ error: "Settings sync is disabled" }, { status: 403 });
    }

    await convex.mutation(api.users.updateUser, {
      id: user.userId as any,
      settings
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings sync POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
