import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerateAvatar } from "@/lib/avatar";

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id;
    
    // Generate new avatar
    const newAvatarUrl = regenerateAvatar(userId, session.user.email || undefined);
    
    // Update user's avatar in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        image: newAvatarUrl,
        imageType: 'generated'
      },
    });

    return NextResponse.json({
      success: true,
      message: "Avatar regenerated successfully",
      avatarUrl: newAvatarUrl,
    });
  } catch (error) {
    console.error("Error regenerating avatar:", error);
    return NextResponse.json(
      { error: "Failed to regenerate avatar" },
      { status: 500 }
    );
  }
}
