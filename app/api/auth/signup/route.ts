import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConvexClient } from "@/lib/convex-client";
import { generateAvatarUrl } from "@/lib/avatar";
import { prelude } from "@/lib/prelude";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { applyRateLimit, RateLimitPresets } from "@/lib/rate-limit";
import { sanitizeUsername, sanitizeEmail, isValidEmail, isValidUsername } from "@/lib/sanitize";
import { trackServerAuth, flushServerEvents } from "@/lib/analytics-server";
import { WideEvent } from "@/lib/wide-event";

const signupSchema = z.object({
  username: z.string().min(3).max(12).regex(/^[a-zA-Z0-9]+$/, "Username must contain only letters and numbers"),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/auth/signup' });

  // Apply rate limiting
  const rateLimitResponse = await applyRateLimit(request, {
    ...RateLimitPresets.auth,
    keyPrefix: 'signup'
  });

  if (rateLimitResponse) {
    wideEvent.setError({ type: 'RateLimitError', message: 'Too many signup attempts', code: 'rate_limited' });
    wideEvent.setAuth({ action: 'signup', success: false, failure_reason: 'rate_limited' });
    wideEvent.finish(429);
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { username, email, password } = signupSchema.parse(body);

    // Sanitize and validate inputs
    const sanitizedUsername = sanitizeUsername(username);
    const sanitizedEmail = sanitizeEmail(email);

    // Validate sanitized inputs
    if (!isValidUsername(sanitizedUsername)) {
      wideEvent.setError({ type: 'ValidationError', message: 'Invalid username format', code: 'invalid_username' });
      wideEvent.setAuth({ action: 'signup', success: false, failure_reason: 'invalid_username' });
      wideEvent.finish(400);

      return NextResponse.json(
        { error: "Invalid username format" },
        { status: 400 }
      );
    }

    if (!isValidEmail(sanitizedEmail)) {
      wideEvent.setError({ type: 'ValidationError', message: 'Invalid email format', code: 'invalid_email' });
      wideEvent.setAuth({ action: 'signup', success: false, failure_reason: 'invalid_email' });
      wideEvent.finish(400);

      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // Check if user already exists by email
    const existingUserByEmail = await convex.query(api.users.getUserByEmail, { email: sanitizedEmail });
    if (existingUserByEmail) {
      wideEvent.setUser({ id: existingUserByEmail._id });
      wideEvent.setError({ type: 'ConflictError', message: 'Email already exists', code: 'email_exists', domain: 'validation' });
      wideEvent.setAuth({ action: 'signup', method: 'email', success: false, failure_reason: 'email_exists' });
      wideEvent.finish(400);

      trackServerAuth({
        event_type: 'failed_signup',
        method: 'email',
        error_type: 'email_exists',
      });
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Check if user already exists by username
    const existingUserByUsername = await convex.query(api.users.getUserByUsername, { username: sanitizedUsername });
    if (existingUserByUsername) {
      wideEvent.setUser({ id: existingUserByUsername._id });
      wideEvent.setError({ type: 'ConflictError', message: 'Username already exists', code: 'username_exists', domain: 'validation' });
      wideEvent.setAuth({ action: 'signup', method: 'username', success: false, failure_reason: 'username_exists' });
      wideEvent.finish(400);

      trackServerAuth({
        event_type: 'failed_signup',
        method: 'username',
        error_type: 'username_exists',
      });
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: "User with this username already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userId = await convex.mutation(api.users.createUser, {
      username: sanitizedUsername,
      email: sanitizedEmail,
      password: hashedPassword,
      name: sanitizedUsername, // Use username as display name initially
    });

    // Generate avatar URL after user creation
    const avatarUrl = generateAvatarUrl(userId, sanitizedEmail);

    // Update user with avatar
    await convex.mutation(api.users.updateUser, {
      id: userId,
      image: avatarUrl,
      imageType: 'generated'
    });

    // Send verification email using Prelude
    try {
      const verification = await prelude.verification.create({
        target: {
          type: "email_address",
          value: sanitizedEmail,
        },
      });

      // Store verification ID in user record
      await convex.mutation(api.users.updateUser, {
        id: userId,
        emailVerificationToken: verification.id,
      });
    } catch (verificationError) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to send verification email:", verificationError);
      }
      // Continue with signup even if verification fails
    }

    // Get the updated user data
    const updatedUser = await convex.query(api.users.getUserById, { id: userId });

    if (!updatedUser) {
      throw new Error("Failed to retrieve created user");
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = updatedUser;

    // Log successful signup
    wideEvent.setUser({ id: userId, subscription: 'free' });
    wideEvent.setAuth({ action: 'signup', method: 'email', success: true });
    wideEvent.setCustom('verification_email_sent', true);
    wideEvent.finish(201);

    // Track successful signup
    trackServerAuth({
      event_type: 'signup',
      method: 'email',
    });
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      {
        message: "User created successfully. Please check your email for verification code.",
        user: userWithoutPassword,
        requiresVerification: true
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      wideEvent.setError({ type: 'ValidationError', message: 'Invalid input data', code: 'validation_error' });
      wideEvent.setAuth({ action: 'signup', success: false, failure_reason: 'validation_error' });
      wideEvent.finish(400);

      trackServerAuth({
        event_type: 'failed_signup',
        method: 'email',
        error_type: 'validation_error',
      });
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    wideEvent.setError(error as Error);
    wideEvent.setAuth({ action: 'signup', success: false, failure_reason: 'server_error' });
    wideEvent.finish(500);

    if (process.env.NODE_ENV === 'development') {
      console.error("Signup error:", error);
    }
    trackServerAuth({
      event_type: 'failed_signup',
      method: 'email',
      error_type: 'server_error',
    });
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
