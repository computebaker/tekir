import { NextRequest, NextResponse } from "next/server";
import { prelude } from "@/lib/prelude";
import { getConvexClient } from "@/lib/convex-client";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { applyRateLimit, RateLimitPresets } from "@/lib/rate-limit";
import { sanitizeEmail, isValidEmail } from "@/lib/sanitize";

const sendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  // Apply rate limiting (stricter limits for email sending)
  const rateLimitResponse = await applyRateLimit(request, {
    maxRequests: 3, // 3 requests per 15 minutes
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'send-verification'
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { email } = sendVerificationSchema.parse(body);

    // Sanitize and validate email
    const sanitizedEmail = sanitizeEmail(email);
    if (!isValidEmail(sanitizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Check if user exists but is not verified
    const user = await convex.query(api.users.getUserByEmail, { email: sanitizedEmail });

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
        value: sanitizedEmail,
      },
    });

    // Store verification ID in user record
    await convex.mutation(api.users.updateUser, {
      id: user._id,
      emailVerificationToken: verification.id,
    });

    return NextResponse.json(
      { message: "Verification code sent successfully" },
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
      console.error("Send verification error:", error);
    }
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
