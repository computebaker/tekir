import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { enabled } = await request.json();

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const updateData: any = { 
      settingsSync: enabled,
    };

    // Clear settings if disabling sync
    if (enabled === false) {
      updateData.settings = null;
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { settingsSync: true, settings: true }
    });

    return NextResponse.json({
      settingsSync: user.settingsSync,
      settings: user.settings || {}
    });
  } catch (error) {
    console.error("Settings sync toggle error:", error);
    
    // Handle case where user doesn't exist in database but session is still valid
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ 
        error: "User record not found. Please sign out and sign in again." 
      }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
