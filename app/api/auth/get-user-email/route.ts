import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex-client";
import { z } from "zod";
import { api } from "@/convex/_generated/api";

const getUserEmailSchema = z.object({
  username: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = getUserEmailSchema.parse(body);

    const convex = getConvexClient();

    // Find user by username
    const user = await convex.query(api.users.getUserByUsername, { username });

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

    if (process.env.NODE_ENV === 'development') {
      console.error("Get user email error:", error);
    }
    return NextResponse.json(
      { error: "Failed to get user email" },
      { status: 500 }
    );
  }
}
