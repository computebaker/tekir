import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Rate limiting mutations and queries
 * Uses a simple in-memory approach with document-based storage
 */

export const checkLimit = mutation({
  args: {
    identifier: v.string(),
    keyPrefix: v.string(),
    maxRequests: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windowStart = now - args.windowMs;
    const rateLimitKey = `${args.keyPrefix}:${args.identifier}`;

    // Get or create rate limit record
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", rateLimitKey))
      .unique();

    if (!existing) {
      // First request - create record
      await ctx.db.insert("rateLimits", {
        key: rateLimitKey,
        count: 1,
        windowStart: now,
        resetAt: now + args.windowMs,
        lastUpdated: now,
      });

      return {
        success: true,
        count: 1,
        resetAt: now + args.windowMs,
      };
    }

    // Check if the window has expired
    if (existing.windowStart < windowStart) {
      // Window expired - reset counter
      await ctx.db.patch(existing._id, {
        count: 1,
        windowStart: now,
        resetAt: now + args.windowMs,
        lastUpdated: now,
      });

      return {
        success: true,
        count: 1,
        resetAt: now + args.windowMs,
      };
    }

    // Check if limit exceeded
    if (existing.count >= args.maxRequests) {
      return {
        success: false,
        count: existing.count,
        resetAt: existing.resetAt,
      };
    }

    // Increment counter
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      lastUpdated: now,
    });

    return {
      success: true,
      count: existing.count + 1,
      resetAt: existing.resetAt,
    };
  },
});

export const resetLimit = mutation({
  args: {
    identifier: v.string(),
    keyPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    const rateLimitKey = `${args.keyPrefix}:${args.identifier}`;

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", rateLimitKey))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

/**
 * Cleanup old rate limit records
 * Should be called periodically (e.g., via cron job)
 */
export const cleanupOldRecords = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const records = await ctx.db
      .query("rateLimits")
      .withIndex("by_windowStart")
      .collect();

    let deleted = 0;
    for (const record of records) {
      if (record.windowStart < oneHourAgo) {
        await ctx.db.delete(record._id);
        deleted++;
      }
    }

    return { deleted };
  },
});
