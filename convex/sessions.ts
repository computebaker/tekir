import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { yyyymmdd } from "./usage";

// Rate limiting constants
const RATE_LIMITS = {
  ANONYMOUS_DAILY_LIMIT: 600,
  AUTHENTICATED_DAILY_LIMIT: 1200,
  SESSION_EXPIRATION_SECONDS: 24 * 60 * 60, // 24 hours
  RESET_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
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
        // Count site visit once per day per user on first reuse within day
        try {
          const day = yyyymmdd(Date.now());
          const existingDay = await ctx.db
            .query('siteVisitsDaily')
            .withIndex('by_day', q => q.eq('day', day))
            .first();
          if (existingDay) await ctx.db.patch(existingDay._id, { count: existingDay.count + 1 });
          else await ctx.db.insert('siteVisitsDaily', { day, count: 1 });
        } catch {}
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

      // Count site visit for new authenticated session
      try {
        const day = yyyymmdd(Date.now());
        const existingDay = await ctx.db
          .query('siteVisitsDaily')
          .withIndex('by_day', q => q.eq('day', day))
          .first();
        if (existingDay) await ctx.db.patch(existingDay._id, { count: existingDay.count + 1 });
        else await ctx.db.insert('siteVisitsDaily', { day, count: 1 });
      } catch {}

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
        // Count site visit on reuse within day
        try {
          const day = yyyymmdd(Date.now());
          const existingDay = await ctx.db
            .query('siteVisitsDaily')
            .withIndex('by_day', q => q.eq('day', day))
            .first();
          if (existingDay) await ctx.db.patch(existingDay._id, { count: existingDay.count + 1 });
          else await ctx.db.insert('siteVisitsDaily', { day, count: 1 });
        } catch {}
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

    // Count site visit for new anonymous session
    try {
      const day = yyyymmdd(Date.now());
      const existingDay = await ctx.db
        .query('siteVisitsDaily')
        .withIndex('by_day', q => q.eq('day', day))
        .first();
      if (existingDay) await ctx.db.patch(existingDay._id, { count: existingDay.count + 1 });
      else await ctx.db.insert('siteVisitsDaily', { day, count: 1 });
    } catch {}

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

// Query to check current rate limit status without incrementing
export const getRateLimitStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessionTracking")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();

    if (!session) {
      return { 
        isValid: false, 
        currentCount: 0, 
        limit: RATE_LIMITS.ANONYMOUS_DAILY_LIMIT,
        remaining: 0,
        isAuthenticated: false 
      };
    }

    const isExpired = session.expiresAt <= Date.now();
    if (isExpired || !session.isActive) {
      return { 
        isValid: false, 
        currentCount: session.requestCount, 
        limit: session.userId ? RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT : RATE_LIMITS.ANONYMOUS_DAILY_LIMIT,
        remaining: 0,
        isAuthenticated: !!session.userId 
      };
    }

    const limit = session.userId ? RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT : RATE_LIMITS.ANONYMOUS_DAILY_LIMIT;
    const remaining = Math.max(0, limit - session.requestCount);

    return {
      isValid: true,
      currentCount: session.requestCount,
      limit,
      remaining,
      isAuthenticated: !!session.userId,
      resetTime: new Date(Date.now() + RATE_LIMITS.RESET_INTERVAL_MS).toISOString()
    };
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

    const maxRequests = session.userId ? RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT : RATE_LIMITS.ANONYMOUS_DAILY_LIMIT;

    // Pre-calculate if request would be allowed
    const newCount = session.requestCount + 1;
    const wouldBeAllowed = newCount <= maxRequests;

    if (wouldBeAllowed) {
      try {
        await ctx.db.patch(session._id, {
          requestCount: newCount,
        });
        // Count API hit on allowed request
        try {
          const day = yyyymmdd(Date.now());
          const existing = await ctx.db
            .query('apiHitsDaily')
            .withIndex('by_day', q => q.eq('day', day))
            .first();
          if (existing) await ctx.db.patch(existing._id, { count: existing.count + 1 });
          else await ctx.db.insert('apiHitsDaily', { day, count: 1 });
        } catch {}
        
        return {
          allowed: true,
          currentCount: newCount,
        };
      } catch (error) {
        // If patch fails due to concurrent modification, read current state and return
        const updatedSession = await ctx.db.get(session._id);
        if (!updatedSession) {
          return { allowed: false, currentCount: 0 };
        }

        // Return current state without retrying the increment to avoid further conflicts
        return {
          allowed: updatedSession.requestCount < maxRequests,
          currentCount: updatedSession.requestCount,
        };
      }
    } else {
      // Request would exceed limit, don't increment
      return {
        allowed: false,
        currentCount: session.requestCount,
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
        // Only extend expiration if it's significantly shorter than requested
        const timeUntilExpiry = existingUserSession.expiresAt - Date.now();
        const halfRequestedTime = (expirationInSeconds * 1000) / 2;
        
        if (timeUntilExpiry < halfRequestedTime) {
          try {
            await ctx.db.patch(existingUserSession._id, { expiresAt });
          } catch (error) {
            // If patch fails, still return the existing token
            console.warn("Failed to extend session expiration, but returning existing token");
          }
        }
        
        return {
          sessionToken: existingUserSession.sessionToken,
          isExisting: true,
          requestLimit: RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT,
        };
      }

      // Create new authenticated session with unique token to avoid conflicts
      const sessionToken = generateSessionToken();
      try {
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
      } catch (error) {
        // If insert fails, try to find if a session was created concurrently
        const concurrentSession = await ctx.db
          .query("sessionTracking")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
          .first();
        
        if (concurrentSession) {
          return {
            sessionToken: concurrentSession.sessionToken,
            isExisting: true,
            requestLimit: RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT,
          };
        }
        
        // If still failing, rethrow the error
        throw error;
      }
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
        // Only extend expiration if it's significantly shorter than requested  
        const timeUntilExpiry = existingIpSession.expiresAt - Date.now();
        const halfRequestedTime = (expirationInSeconds * 1000) / 2;
        
        if (timeUntilExpiry < halfRequestedTime) {
          try {
            await ctx.db.patch(existingIpSession._id, { expiresAt });
          } catch (error) {
            // If patch fails, still return the existing token
            console.warn("Failed to extend session expiration, but returning existing token");
          }
        }
        
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
    const currentTime = Date.now();
    
    // Find expired sessions in batches to avoid large transactions
    const expiredSessions = await ctx.db
      .query("sessionTracking")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", currentTime))
      .take(100); // Process in batches of 100

    let deletedCount = 0;
    
    // Delete expired sessions one by one to avoid conflicts
    for (const session of expiredSessions) {
      try {
        await ctx.db.delete(session._id);
        deletedCount++;
      } catch (error) {
        // If deletion fails (e.g., already deleted), continue with others
        console.warn(`Failed to delete expired session ${session._id}:`, error);
      }
    }

    return { 
      deletedCount,
      hasMore: expiredSessions.length === 100 // Indicates if there might be more to clean
    };
  },
});

// New mutation to reset daily request counts (can be called by a cron job)
export const resetDailyRequestCounts = mutation({
  args: {},
  handler: async (ctx) => {
    const currentTime = Date.now();
    const yesterday = currentTime - (24 * 60 * 60 * 1000);
    
    // Find active sessions that haven't been reset today
    const sessionsToReset = await ctx.db
      .query("sessionTracking")
      .filter((q) => 
        q.and(
          q.gt(q.field("expiresAt"), currentTime), // Still valid
          q.eq(q.field("isActive"), true), // Still active
          q.gt(q.field("requestCount"), 0) // Has requests to reset
        )
      )
      .take(50); // Process in smaller batches

    let resetCount = 0;
    
    for (const session of sessionsToReset) {
      try {
        await ctx.db.patch(session._id, {
          requestCount: 0,
        });
        resetCount++;
      } catch (error) {
        console.warn(`Failed to reset request count for session ${session._id}:`, error);
      }
    }

    return { 
      resetCount,
      hasMore: sessionsToReset.length === 50
    };
  },
});
