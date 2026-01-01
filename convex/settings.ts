import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUserWithToken } from "./auth";

const userSettingsResponse = v.object({
  settingsSync: v.boolean(),
  settings: v.any(),
  updatedAt: v.number(),
});

const isUnauthorizedError = (error: unknown) =>
  error instanceof Error && (error.message.startsWith("Unauthorized") || error.message.startsWith("Forbidden"));

// Query to get user settings with real-time subscription
export const getUserSettings = query({
  args: {
    userId: v.id("users"),
    authToken: v.string(),
  },
  returns: v.union(userSettingsResponse, v.null()),
  handler: async (ctx, args) => {
    try {
      const user = await requireUserWithToken(ctx, args.userId, args.authToken);

      return {
        settingsSync: user.settingsSync,
        settings: user.settings ?? {},
        updatedAt: user.updatedAt
      };
    } catch (error) {
      if (isUnauthorizedError(error)) {
        console.error('[Convex Settings] Auth error:', error instanceof Error ? error.message : error);
        // Only log that auth token was present, not its contents - security best practice
        console.error('[Convex Settings] Args:', {
          userId: args.userId,
          hasToken: !!args.authToken
        });
        return null;
      }
      throw error;
    }
  },
});

// Mutation to update user settings
export const updateUserSettings = mutation({
  args: {
    userId: v.id("users"),
    authToken: v.string(),
    settings: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserWithToken(ctx, args.userId, args.authToken);

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
    authToken: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireUserWithToken(ctx, args.userId, args.authToken); // Ensure user exists and authorized

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
  args: {
    userId: v.id("users"),
    authToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserWithToken(ctx, args.userId, args.authToken);

    return {
      settingsSync: user.settingsSync,
      updatedAt: user.updatedAt
    };
  },
});
