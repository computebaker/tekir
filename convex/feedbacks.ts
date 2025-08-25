import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createFeedback = mutation({
  args: {
    userId: v.optional(v.id("users")),
    sessionToken: v.optional(v.string()),
    query: v.optional(v.string()),
    searchEngine: v.optional(v.string()),
    searchType: v.optional(v.string()),
    results: v.optional(v.any()),
    wikipedia: v.optional(v.any()),
    autocomplete: v.optional(v.any()),
    karakulak: v.optional(v.any()),
    liked: v.boolean(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    const payload: any = {
      userId: args.userId,
      sessionToken: args.sessionToken,
      query: args.query,
      searchEngine: args.searchEngine,
      searchType: args.searchType,
      results: args.results,
      wikipedia: args.wikipedia,
      autocomplete: args.autocomplete,
      karakulak: args.karakulak,
      liked: args.liked,
      comment: args.comment,
      createdAt,
    };

    await ctx.db.insert("feedbacks", payload);

    return { success: true };
  },
});

// Admin: list feedbacks (recent first)
export const listFeedbacks = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const items = await ctx.db
      .query("feedbacks")
      .order("desc")
      .collect();
    return items.slice(0, limit);
  },
});

// Admin: delete a feedback record
export const deleteFeedback = mutation({
  args: { id: v.id("feedbacks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return true;
  },
});

// Admin: count feedbacks
export const countFeedbacks = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("feedbacks").collect();
    return items.length;
  },
});
