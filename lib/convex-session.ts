import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { randomBytes } from "crypto";
import { createHash } from "crypto";

const convex = getConvexClient();

// Helper functions
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

// Check if Convex is configured (always true for Convex)
export const isConvexConfigured = true;

// Session validation
export async function isValidSessionToken(token: string): Promise<boolean> {
  try {
    const result = await convex.query(api.sessions.isValidSessionToken, { sessionToken: token });
    return result.isValid;
  } catch (error) {
    console.error("Error validating session token:", error);
    return false;
  }
}

// Session registration
export async function registerSessionToken(
  hashedIp: string | null, 
  expirationInSeconds: number = 24 * 60 * 60,
  userId: string | null = null
): Promise<string | null> {
  try {
    const sessionToken = generateSessionToken();
    
    const result = await convex.mutation(api.sessions.registerSessionToken, {
      sessionToken,
      hashedIp: hashedIp || undefined,
      userId: userId as any || undefined, // Cast to Convex ID type
      expirationInSeconds,
    });

    return result;
  } catch (error) {
    console.error("Error registering session token:", error);
    return null;
  }
}

// Request count management
export async function incrementAndCheckRequestCount(token: string): Promise<{ allowed: boolean; currentCount: number }> {
  try {
    return await convex.mutation(api.sessions.incrementAndCheckRequestCount, { sessionToken: token });
  } catch (error) {
    console.error("Error incrementing request count:", error);
    return { allowed: false, currentCount: 0 };
  }
}

// Link session to user
export async function linkSessionToUser(token: string, userId: string): Promise<boolean> {
  try {
    return await convex.mutation(api.sessions.linkSessionToUser, { 
      sessionToken: token, 
      userId: userId as any // Convex ID type
    });
  } catch (error) {
    console.error("Error linking session to user:", error);
    return false;
  }
}

// Clean expired sessions (can be called periodically)
export async function cleanExpiredSessions(): Promise<{ deletedCount: number }> {
  try {
    return await convex.mutation(api.sessions.cleanExpiredSessions, {});
  } catch (error) {
    console.error("Error cleaning expired sessions:", error);
    return { deletedCount: 0 };
  }
}
