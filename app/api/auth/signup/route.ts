import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConvexClient } from "@/lib/convex-client";
import { generateAvatarUrl } from "@/lib/avatar";
import { prelude } from "@/lib/prelude";
import { z } from "zod";
import { api } from "@/convex/_generated/api";

const signupSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = signupSchema.parse(body);

    const convex = getConvexClient();

    // Check if user already exists by email
    const existingUserByEmail = await convex.query(api.users.getUserByEmail, { email });
    if (existingUserByEmail) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Check if user already exists by username
    const existingUserByUsername = await convex.query(api.users.getUserByUsername, { username });
    if (existingUserByUsername) {
      return NextResponse.json(
        { error: "User with this username already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userId = await convex.mutation(api.users.createUser, {
      username,
      email,
      password: hashedPassword,
      name: username, // Use username as display name initially
    });

    // Generate avatar URL after user creation
    const avatarUrl = generateAvatarUrl(userId, email);
    
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
          value: email,
        },
      });

      // Store verification ID in user record
      await convex.mutation(api.users.updateUser, {
        id: userId,
        emailVerificationToken: verification.id,
      });
    } catch (verificationError) {
      console.error("Failed to send verification email:", verificationError);
      // Continue with signup even if verification fails
    }

    // Get the updated user data
    const updatedUser = await convex.query(api.users.getUserById, { id: userId });

    if (!updatedUser) {
      throw new Error("Failed to retrieve created user");
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = updatedUser;

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
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
