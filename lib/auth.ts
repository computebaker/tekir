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
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          username: (user as any).username,
          image: (user as any).image,
          imageType: (user as any).imageType,
        };
      }
      return token;
    },
    async session({ session, token }) {
      // Fetch the latest user data including image from database
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { image: true, imageType: true },
        });
        
        return {
          ...session,
          user: {
            ...session.user,
            id: token.sub,
            username: token.username,
            image: dbUser?.image || session.user?.image,
            imageType: dbUser?.imageType,
          },
        };
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};
