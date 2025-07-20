import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Authentication sessions (NextAuth compatible)
export const createSession = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.id("users"),
    expires: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", args);
  },
});

export const getSessionByToken = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expires <= Date.now()) {
      return null;
    }

    return session;
  },
});

export const updateSession = mutation({
  args: {
    sessionToken: v.string(),
    expires: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();

    if (!session) {
      return null;
    }

    const updates = Object.fromEntries(
      Object.entries(args).filter(([key, value]) => key !== "sessionToken" && value !== undefined)
    );

    await ctx.db.patch(session._id, updates);
    return session._id;
  },
});

export const deleteSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .unique();

    if (session) {
      await ctx.db.delete(session._id);
    }

    return true;
  },
});

// Account management (OAuth)
export const createAccount = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    provider: v.string(),
    providerAccountId: v.string(),
    refresh_token: v.optional(v.string()),
    access_token: v.optional(v.string()),
    expires_at: v.optional(v.number()),
    token_type: v.optional(v.string()),
    scope: v.optional(v.string()),
    id_token: v.optional(v.string()),
    session_state: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("accounts", args);
  },
});

export const getAccountByProvider = query({
  args: {
    provider: v.string(),
    providerAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_provider_account", (q) => 
        q.eq("provider", args.provider).eq("providerAccountId", args.providerAccountId)
      )
      .unique();
  },
});

// Verification tokens
export const createVerificationToken = mutation({
  args: {
    identifier: v.string(),
    token: v.string(),
    expires: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("verificationTokens", args);
  },
});

export const getVerificationToken = query({
  args: {
    identifier: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const verificationToken = await ctx.db
      .query("verificationTokens")
      .withIndex("by_identifier_token", (q) => 
        q.eq("identifier", args.identifier).eq("token", args.token)
      )
      .unique();

    if (!verificationToken) {
      return null;
    }

    // Check if token is expired
    if (verificationToken.expires <= Date.now()) {
      return null;
    }

    return verificationToken;
  },
});

export const deleteVerificationToken = mutation({
  args: {
    identifier: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const verificationToken = await ctx.db
      .query("verificationTokens")
      .withIndex("by_identifier_token", (q) => 
        q.eq("identifier", args.identifier).eq("token", args.token)
      )
      .unique();

    if (verificationToken) {
      await ctx.db.delete(verificationToken._id);
    }

    return true;
  },
});
