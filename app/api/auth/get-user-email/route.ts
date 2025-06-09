import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const getUserEmailSchema = z.object({
  username: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = getUserEmailSchema.parse(body);

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: { email: true }, // Only select email for privacy
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { email: user.email },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Get user email error:", error);
    return NextResponse.json(
      { error: "Failed to get user email" },
      { status: 500 }
    );
  }
}
