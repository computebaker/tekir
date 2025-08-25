import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function yyyymmdd(ts: number) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return Number(`${y}${m}${day}`);
}

// Privacy-safe tokenizer: lowercases, strips punctuation, splits on whitespace, filters short tokens
function tokenize(input: string): string[] {
  // Normalize and keep letters/numbers/space for broad locales without needing \p{...}
  const cleaned = (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]+/g, ' '); // basic ascii fallback
  return cleaned
    .split(/\s+/)
    .filter(t => t.length >= 2 && t.length <= 32)
    .slice(0, 20);
}

export const logSearchUsage = mutation({
  args: {
    provider: v.string(), // 'brave' | 'duck' | ...
    type: v.string(), // 'web' | 'images' | 'news'
    responseTimeMs: v.optional(v.number()),
    totalResults: v.optional(v.number()),
    queryText: v.optional(v.string()), // used only for token frequency, not stored
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.timestamp ?? Date.now();
    const day = yyyymmdd(now);

    // Upsert daily aggregate for search usage
    const existing = await ctx.db
      .query('searchUsageDaily')
      .withIndex('by_day_provider', q => q.eq('day', day).eq('provider', args.provider))
      .filter(q => q.eq(q.field('type'), args.type))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        totalResponseTimeMs: (existing.totalResponseTimeMs || 0) + (args.responseTimeMs || 0),
        totalResults: (existing.totalResults || 0) + (args.totalResults || 0),
      });
    } else {
      await ctx.db.insert('searchUsageDaily', {
        day,
        provider: args.provider,
        type: args.type,
        count: 1,
        totalResponseTimeMs: args.responseTimeMs || 0,
        totalResults: args.totalResults || 0,
      });
    }

    // Token frequency (privacy-safe): do not store raw queries, only token counts
    if (args.queryText) {
      const tokens = tokenize(args.queryText);
      for (const token of tokens) {
        const tokenRow = await ctx.db
          .query('searchTokenDaily')
          .withIndex('by_day_token', q => q.eq('day', day).eq('token', token))
          .first();
        if (tokenRow) {
          await ctx.db.patch(tokenRow._id, { count: tokenRow.count + 1 });
        } else {
          await ctx.db.insert('searchTokenDaily', { day, token, count: 1 });
        }
      }
    }

    return { ok: true };
  },
});

export const logAiUsage = mutation({
  args: {
    model: v.string(), // 'gemini' | 'llama' | 'mistral' | 'chatgpt'
    latencyMs: v.optional(v.number()),
    answerChars: v.optional(v.number()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.timestamp ?? Date.now();
    const day = yyyymmdd(now);

    const existing = await ctx.db
      .query('aiUsageDaily')
      .withIndex('by_day_model', q => q.eq('day', day).eq('model', args.model))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        totalLatencyMs: (existing.totalLatencyMs || 0) + (args.latencyMs || 0),
        totalAnswerChars: (existing.totalAnswerChars || 0) + (args.answerChars || 0),
      });
    } else {
      await ctx.db.insert('aiUsageDaily', {
        day,
        model: args.model,
        count: 1,
        totalLatencyMs: args.latencyMs || 0,
        totalAnswerChars: args.answerChars || 0,
      });
    }

    return { ok: true };
  },
});

// Queries for analytics pages
export const getSearchUsageByDay = query({
  args: { day: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('searchUsageDaily')
      .withIndex('by_day', q => q.eq('day', args.day))
      .collect();
  },
});

export const getAiUsageByDay = query({
  args: { day: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('aiUsageDaily')
      .withIndex('by_day', q => q.eq('day', args.day))
      .collect();
  },
});

export const topSearchTokensByDay = query({
  args: { day: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('searchTokenDaily')
      .withIndex('by_day', q => q.eq('day', args.day))
      .collect();
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    return rows
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },
});

export const rangeSearchUsage = query({
  args: { fromDay: v.number(), toDay: v.number() },
  handler: async (ctx, args) => {
    // naive range scan; can be optimized with pagination if needed
    const rows = await ctx.db
      .query('searchUsageDaily')
      .withIndex('by_day', q => q.gte('day', args.fromDay).lte('day', args.toDay))
      .collect();
    return rows;
  },
});

export const rangeAiUsage = query({
  args: { fromDay: v.number(), toDay: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('aiUsageDaily')
      .withIndex('by_day', q => q.gte('day', args.fromDay).lte('day', args.toDay))
      .collect();
    return rows;
  },
});
