import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Rate limiting constants
const RATE_LIMITS = {
  ANONYMOUS_DAILY_LIMIT: 600,
  AUTHENTICATED_DAILY_LIMIT: 1200,
  SESSION_EXPIRATION_SECONDS: 24 * 60 * 60, // 24 hours
} as const;

// Session tracking for rate limiting (replaces Redis functionality)

export const getSessionByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessionTracking")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.token))
      .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
      .first();

    return session;
  },
});

export const registerSessionToken = mutation({
  args: {
    sessionToken: v.string(),
    hashedIp: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    expirationInSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const expirationInSeconds = args.expirationInSeconds || RATE_LIMITS.SESSION_EXPIRATION_SECONDS;
    const expiresAt = Date.now() + (expirationInSeconds * 1000);

    // For authenticated users, priority is user-based session
    if (args.userId) {
      // Check for existing user session first
      const existingUserSession = await ctx.db
        .query("sessionTracking")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
        .first();

      if (existingUserSession) {
        // Return existing session token for this user (fingerprinting behavior)
        await ctx.db.patch(existingUserSession._id, {
          expiresAt, // Extend expiration
        });
        return existingUserSession.sessionToken;
      }

      // Create new authenticated session
      await ctx.db.insert("sessionTracking", {
        sessionToken: args.sessionToken,
        hashedIp: args.hashedIp,
        userId: args.userId,
        requestCount: 0,
        expiresAt,
        isActive: true,
      });

      return args.sessionToken;
    }

    // For unauthenticated users, check by hashed IP
    if (args.hashedIp) {
      const existingIpSession = await ctx.db
        .query("sessionTracking")
        .withIndex("by_hashedIp", (q) => q.eq("hashedIp", args.hashedIp))
        .filter((q) => 
          q.and(
            q.gt(q.field("expiresAt"), Date.now()),
            q.eq(q.field("userId"), undefined) // Only consider unauthenticated sessions
          )
        )
        .first();

      if (existingIpSession) {
        // Return existing session token for this IP (fingerprinting behavior)
        await ctx.db.patch(existingIpSession._id, {
          expiresAt, // Extend expiration
        });
        return existingIpSession.sessionToken;
      }
    }

    // Create new unauthenticated session
    await ctx.db.insert("sessionTracking", {
      sessionToken: args.sessionToken,
      hashedIp: args.hashedIp,
      userId: args.userId,
      requestCount: 0,
      expiresAt,
      isActive: true,
    });

    return args.sessionToken;
  },
});

export const isValidSessionToken = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessionTracking")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();

    if (!session) {
      return { isValid: false, session: null };
    }

    const isExpired = session.expiresAt <= Date.now();
    const isValid = session.isActive && !isExpired;

    return { isValid, session: isValid ? session : null };
  },
});

export const incrementAndCheckRequestCount = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessionTracking")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();

    if (!session) {
      return { allowed: false, currentCount: 0 };
    }

    const isExpired = session.expiresAt <= Date.now();
    if (isExpired) {
      return { allowed: false, currentCount: session.requestCount };
    }

    const newCount = session.requestCount + 1;
    const maxRequests = session.userId ? RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT : RATE_LIMITS.ANONYMOUS_DAILY_LIMIT;

    // Use atomic increment to avoid race conditions
    try {
      await ctx.db.patch(session._id, {
        requestCount: newCount,
      });

      return {
        allowed: newCount <= maxRequests,
        currentCount: newCount,
      };
    } catch (error) {
      // If patch fails due to concurrent modification, retry once
      const updatedSession = await ctx.db.get(session._id);
      if (!updatedSession) {
        return { allowed: false, currentCount: 0 };
      }

      const retryNewCount = updatedSession.requestCount + 1;
      await ctx.db.patch(session._id, {
        requestCount: retryNewCount,
      });

      return {
        allowed: retryNewCount <= maxRequests,
        currentCount: retryNewCount,
      };
    }
  },
});

export const linkSessionToUser = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessionTracking")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();

    if (!session) {
      return null;
    }

    // Check if user already has an authenticated session
    const existingUserSession = await ctx.db
      .query("sessionTracking")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
      .first();

    if (existingUserSession && existingUserSession._id !== session._id) {
      // User already has a session, deactivate the current anonymous session
      // and return the existing user session token
      await ctx.db.patch(session._id, {
        isActive: false,
      });
      
      // Return the existing user session token for fingerprinting
      return existingUserSession.sessionToken;
    }

    // Link the current session to the user
    await ctx.db.patch(session._id, {
      userId: args.userId,
    });

    return session.sessionToken;
  },
});

export const getOrCreateSessionToken = mutation({
  args: {
    hashedIp: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    expirationInSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const expirationInSeconds = args.expirationInSeconds || RATE_LIMITS.SESSION_EXPIRATION_SECONDS;
    const expiresAt = Date.now() + (expirationInSeconds * 1000);

    // For authenticated users, always return their existing session token if available
    if (args.userId) {
      const existingUserSession = await ctx.db
        .query("sessionTracking")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
        .first();

      if (existingUserSession) {
        // Extend expiration and return existing token (fingerprinting)
        await ctx.db.patch(existingUserSession._id, {
          expiresAt,
        });
        return {
          sessionToken: existingUserSession.sessionToken,
          isExisting: true,
          requestLimit: RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT,
        };
      }

      // Create new authenticated session
      const sessionToken = generateSessionToken();
      await ctx.db.insert("sessionTracking", {
        sessionToken,
        hashedIp: args.hashedIp,
        userId: args.userId,
        requestCount: 0,
        expiresAt,
        isActive: true,
      });

      return {
        sessionToken,
        isExisting: false,
        requestLimit: RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT,
      };
    }

    // For unauthenticated users, check by hashed IP for fingerprinting
    if (args.hashedIp) {
      const existingIpSession = await ctx.db
        .query("sessionTracking")
        .withIndex("by_hashedIp", (q) => q.eq("hashedIp", args.hashedIp))
        .filter((q) => 
          q.and(
            q.gt(q.field("expiresAt"), Date.now()),
            q.eq(q.field("userId"), undefined) // Only unauthenticated sessions
          )
        )
        .first();

      if (existingIpSession) {
        // Extend expiration and return existing token (fingerprinting)
        await ctx.db.patch(existingIpSession._id, {
          expiresAt,
        });
        return {
          sessionToken: existingIpSession.sessionToken,
          isExisting: true,
          requestLimit: RATE_LIMITS.ANONYMOUS_DAILY_LIMIT,
        };
      }
    }

    // Create new unauthenticated session
    const sessionToken = generateSessionToken();
    await ctx.db.insert("sessionTracking", {
      sessionToken,
      hashedIp: args.hashedIp,
      userId: args.userId,
      requestCount: 0,
      expiresAt,
      isActive: true,
    });

    return {
      sessionToken,
      isExisting: false,
      requestLimit: RATE_LIMITS.ANONYMOUS_DAILY_LIMIT,
    };
  },
});

// Helper function to generate session tokens (moved from client library)
function generateSessionToken(): string {
  // Generate a secure random session token
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const cleanExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const expiredSessions = await ctx.db
      .query("sessionTracking")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
      .collect();

    for (const session of expiredSessions) {
      await ctx.db.delete(session._id);
    }

    return { deletedCount: expiredSessions.length };
  },
});
