import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        settingsSync: true,
        settings: true 
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      settingsSync: user.settingsSync,
      settings: user.settings || {}
    });
  } catch (error) {
    console.error("Settings sync GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { settings } = await request.json();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { settingsSync: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.settingsSync) {
      return NextResponse.json({ error: "Settings sync is disabled" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { settings }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings sync POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
