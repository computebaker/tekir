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
    strategy: "jwt",
    maxAge: 15 * 24 * 60 * 60,
    updateAge: 5 * 60, 
    },
    callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        return {
          ...token,
          name: (user as any).name,
          username: (user as any).username,
          image: (user as any).image,
          imageType: (user as any).imageType,
          updatedAt: (user as any).updatedAt,
        };
      }
      
      // Update token when session is updated
      if (trigger === "update" && session) {
        return { 
          ...token, 
          name: session.name || token.name,
          username: session.username || token.username,
          image: session.image || token.image,
          imageType: session.imageType || token.imageType,
          updatedAt: session.updatedAt || token.updatedAt,
        };
      }
      
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
          name: token.name as string | null,
          username: token.username as string | null,
          image: token.image as string | null,
          imageType: token.imageType as string | null,
          updatedAt: token.updatedAt as string | null,
        },
      };
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};