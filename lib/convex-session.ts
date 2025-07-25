import { getConvexClient } from "@/lib/convex-client";
import { api } from "@/convex/_generated/api";
import { randomBytes } from "crypto";
import { createHash } from "crypto";
import { getSessionExpiration } from '@/lib/rate-limits';

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

// Get rate limit status without incrementing count
export async function getRateLimitStatus(token: string) {
  try {
    return await convex.query(api.sessions.getRateLimitStatus, { sessionToken: token });
  } catch (error) {
    console.error("Error getting rate limit status:", error);
    return { 
      isValid: false, 
      currentCount: 0, 
      limit: 600,
      remaining: 0,
      isAuthenticated: false 
    };
  }
}

// Session registration with improved fingerprinting
export async function registerSessionToken(
  hashedIp: string | null, 
  expirationInSeconds: number = getSessionExpiration(),
  userId: string | null = null
): Promise<string | null> {
  try {
    const result = await convex.mutation(api.sessions.getOrCreateSessionToken, {
      hashedIp: hashedIp || undefined,
      userId: userId as any || undefined, // Cast to Convex ID type
      expirationInSeconds,
    });

    return result.sessionToken;
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
export async function linkSessionToUser(token: string, userId: string): Promise<string | null> {
  try {
    const result = await convex.mutation(api.sessions.linkSessionToUser, { 
      sessionToken: token, 
      userId: userId as any // Convex ID type
    });
    return result; // Returns the session token (existing or current)
  } catch (error) {
    console.error("Error linking session to user:", error);
    return null;
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
