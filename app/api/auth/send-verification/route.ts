import { NextRequest, NextResponse } from "next/server";
import { prelude } from "@/lib/prelude";
import { getConvexClient } from "@/lib/convex-client";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { applyRateLimit, RateLimitPresets } from "@/lib/rate-limit";
import { sanitizeEmail, isValidEmail } from "@/lib/sanitize";
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

const sendVerificationSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/auth/send-verification' });
  wideEvent.setCustom('trace_id', traceId);
  
  // Apply rate limiting (stricter limits for email sending)
  const rateLimitResponse = await applyRateLimit(request, {
    maxRequests: 3, // 3 requests per 15 minutes
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'send-verification'
  });

  if (rateLimitResponse) {
    wideEvent.setError({ type: 'RateLimitError', message: 'Rate limit exceeded', code: 'rate_limited' });
    wideEvent.finish(429);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { email } = sendVerificationSchema.parse(body);

    // Sanitize and validate email
    const sanitizedEmail = sanitizeEmail(email);
    if (!isValidEmail(sanitizedEmail)) {
      wideEvent.setError({ type: 'ValidationError', message: 'Invalid email format', code: 'invalid_email' });
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Check if user exists but is not verified
    const user = await convex.query(api.users.getUserByEmail, { email: sanitizedEmail });

    if (!user) {
      wideEvent.setError({ type: 'AuthError', message: 'User not found', code: 'user_not_found' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(404);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    wideEvent.setUser({ id: user._id });

    if (user.emailVerified) {
      wideEvent.setError({ type: 'ValidationError', message: 'Email already verified', code: 'already_verified' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
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
    
    wideEvent.setCustom('verification_sent', true);
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { message: "Verification code sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof z.ZodError) {
      wideEvent.setError({ type: 'ValidationError', message: 'Invalid input', code: 'validation_error' });
      wideEvent.setCustom('latency_ms', duration);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.error("Send verification error:", error);
    }
    
    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Failed to send verification code', code: 'send_verification_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
