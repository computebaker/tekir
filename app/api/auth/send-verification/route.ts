import { NextRequest, NextResponse } from "next/server";
import { prelude } from "@/lib/prelude";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const sendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = sendVerificationSchema.parse(body);

    // Check if user exists but is not verified
    const user = await prisma.user.findUnique({
      where: { email },
      cacheStrategy: { ttl: 60 }, 
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

    // Send verification code using Prelude
    const verification = await prelude.verification.create({
      target: {
        type: "email_address",
        value: email,
      },
    });

    // Store verification ID in user record
    await prisma.user.update({
      where: { email },
      data: {
        emailVerificationToken: verification.id,
      },
    });

    return NextResponse.json(
      { message: "Verification code sent successfully", verificationId: verification.id },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Send verification error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
