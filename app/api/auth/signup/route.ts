import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateAvatarUrl } from "@/lib/avatar";
import { prelude } from "@/lib/prelude";
import { z } from "zod";

const signupSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = signupSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email or username already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with random avatar
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        name: username, // Use username as display name initially
      },
    });

    // Generate avatar URL after user creation (so we have the ID)
    const avatarUrl = generateAvatarUrl(user.id, user.email);
    
    // Update user with avatar
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { 
        image: avatarUrl,
        imageType: 'generated'
      },
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
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: verification.id,
        },
      });
    } catch (verificationError) {
      console.error("Failed to send verification email:", verificationError);
      // Continue with signup even if verification fails
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
