import { NextRequest, NextResponse } from "next/server";
import { prelude } from "@/lib/prelude";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = verifyCodeSchema.parse(body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "Email already verified" },
        { status: 400 }
      );
    }

    // Verify code using Prelude
    const check = await prelude.verification.check({
      target: {
        type: "email_address",
        value: email,
      },
      code: code,
    });

    if (check.status !== "success") {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    // Mark email as verified
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        emailVerified: new Date(),
      },
    });

    // Return success response
    return NextResponse.json(
      { message: "Email verified successfully", user: { id: updatedUser.id, email: updatedUser.email, emailVerified: updatedUser.emailVerified } },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Verify code error:", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
