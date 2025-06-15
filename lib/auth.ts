import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        emailOrUsername: { label: "Email or Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.emailOrUsername || !credentials?.password) {
          return null;
        }

        // Determine if input is email or username
        const isEmail = credentials.emailOrUsername.includes("@");
        
        // Query user by email or username
        const user = await prisma.user.findUnique({
          where: isEmail 
            ? { email: credentials.emailOrUsername }
            : { username: credentials.emailOrUsername },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new Error("Please verify your email before signing in");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          image: user.image,
          imageType: user.imageType,
          updatedAt: user.updatedAt,
        };
      },
    }),
  ],
  session: {
    strategy: "database", // Changed from "jwt" to "database" to populate Session table
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }) {
      // With database strategy, we get user from database, not token
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          name: user.name,
          username: (user as any).username,
          image: user.image,
          imageType: (user as any).imageType,
          updatedAt: (user as any).updatedAt,
        },
      };
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
