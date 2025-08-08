import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Query to get user settings with real-time subscription
export const getUserSettings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    return {
      settingsSync: user.settingsSync,
  settings: user.settings ?? {},
      updatedAt: user.updatedAt
    };
  },
});

// Mutation to update user settings
export const updateUserSettings = mutation({
  args: {
    userId: v.id("users"),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    if (!user.settingsSync) {
      throw new Error("Settings sync is disabled for this user");
    }
    
    await ctx.db.patch(args.userId, {
      settings: args.settings,
      updatedAt: Date.now(),
    });
    
    return {
      success: true,
      settings: args.settings,
      updatedAt: Date.now()
    };
  },
});

// Mutation to toggle settings sync
export const toggleSettingsSync = mutation({
  args: {
    userId: v.id("users"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    const updateData: any = {
      settingsSync: args.enabled,
      updatedAt: Date.now(),
    };
    
    // Clear settings if disabling sync (unset the field to delete data)
    if (!args.enabled) {
      updateData.settings = undefined as any; // Unset optional field to remove stored settings
    }
    
    await ctx.db.patch(args.userId, updateData);
    
    const updatedUser = await ctx.db.get(args.userId);
    
    return {
      settingsSync: updatedUser?.settingsSync || false,
      settings: updatedUser?.settings || {},
      updatedAt: updatedUser?.updatedAt || Date.now()
    };
  },
});

// Query to check if user has settings sync enabled (lightweight)
export const getSettingsSyncStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    return {
      settingsSync: user.settingsSync,
      updatedAt: user.updatedAt
    };
  },
});
