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
