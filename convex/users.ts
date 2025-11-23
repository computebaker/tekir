import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Queries
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
  },
});

export const getUserById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getUserByVerificationToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_emailVerificationToken", (q) => q.eq("emailVerificationToken", args.token))
      .unique();
  },
});

export const getUserByPolarCustomerId = query({
  args: { polarCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_polarCustomerId", (q) => q.eq("polarCustomerId", args.polarCustomerId))
      .unique();
  },
});

// Admin: list users (recent first)
export const listUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();

    if (!user || !user.roles?.includes("admin")) {
      throw new Error("Forbidden: Admin access required");
    }

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const items = await ctx.db
      .query("users")
      .order("desc")
      .collect();
    return items.slice(0, limit);
  },
});

// Admin: count users
export const countUsers = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("users").collect();
    return all.length;
  },
});

// Mutations
export const createUser = mutation({
  args: {
    username: v.string(),
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    imageType: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
    emailVerificationToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Enforce password hashing
    if (!args.password.startsWith("$2")) {
      throw new Error("Password must be hashed before storage");
    }

    const now = Date.now();
    return await ctx.db.insert("users", {
      ...args,
      settingsSync: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateUser = mutation({
  args: {
    id: v.id("users"),
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    emailVerificationToken: v.optional(v.string()),
    password: v.optional(v.string()),
    image: v.optional(v.string()),
    imageType: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
    settingsSync: v.optional(v.boolean()),
    settings: v.optional(v.any()),
    polarCustomerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updateData } = args;

    // Enforce password hashing if password is being updated
    if (updateData.password && !updateData.password.startsWith("$2")) {
      throw new Error("Password must be hashed before storage");
    }

    const updates = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined)
    );

    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const updateUserRoles = mutation({
  args: {
    id: v.id("users"),
    roles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, {
      roles: args.roles,
      updatedAt: Date.now(),
    });
  },
});

export const deleteUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    // Delete related data first

    const sessionTracking = await ctx.db
      .query("sessionTracking")
      .withIndex("by_userId", (q) => q.eq("userId", args.id))
      .collect();

    for (const tracking of sessionTracking) {
      await ctx.db.delete(tracking._id);
    }

    // Delete the user
    return await ctx.db.delete(args.id);
  },
});

export const verifyEmail = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    return await ctx.db.patch(user._id, {
      emailVerified: Date.now(),
      emailVerificationToken: undefined,
      updatedAt: Date.now(),
    });
  },
});
