import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
    const expirationInSeconds = args.expirationInSeconds || 24 * 60 * 60; // 24 hours default
    const expiresAt = Date.now() + (expirationInSeconds * 1000);

    // Check if there's an existing session for this IP or user
    let existingSession = null;

    if (args.userId) {
      existingSession = await ctx.db
        .query("sessionTracking")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
        .first();
    } else if (args.hashedIp) {
      existingSession = await ctx.db
        .query("sessionTracking")
        .withIndex("by_hashedIp", (q) => q.eq("hashedIp", args.hashedIp))
        .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
        .first();
    }

    if (existingSession) {
      // Extend existing session
      await ctx.db.patch(existingSession._id, {
        expiresAt,
        sessionToken: args.sessionToken,
      });
      return args.sessionToken;
    }

    // Create new session
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
    const maxRequests = session.userId ? 1200 : 600; // Higher limit for authenticated users

    await ctx.db.patch(session._id, {
      requestCount: newCount,
    });

    return {
      allowed: newCount <= maxRequests,
      currentCount: newCount,
    };
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
      return false;
    }

    // Check if user already has a session and remove it
    const existingUserSession = await ctx.db
      .query("sessionTracking")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.gt(q.field("expiresAt"), Date.now()))
      .first();

    if (existingUserSession && existingUserSession._id !== session._id) {
      await ctx.db.patch(existingUserSession._id, {
        isActive: false,
      });
    }

    // Link the session to the user
    await ctx.db.patch(session._id, {
      userId: args.userId,
    });

    return true;
  },
});

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
