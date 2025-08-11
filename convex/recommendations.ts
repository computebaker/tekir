import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recommendations")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .unique();
  },
});

export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const recs = await ctx.db
      .query("recommendations")
      .order("desc")
      .collect();
    return recs[0] ?? null;
  },
});

export const upsertForDate = mutation({
  args: {
    date: v.string(),
    dateLabel: v.optional(v.string()),
    items: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("recommendations")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        items: args.items,
        dateLabel: args.dateLabel,
        updatedAt: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("recommendations", {
      date: args.date,
      dateLabel: args.dateLabel,
      items: args.items,
      createdAt: now,
      updatedAt: now,
    });
  },
});
