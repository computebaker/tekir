import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    email: v.string(),
    emailVerified: v.optional(v.number()), // Unix timestamp
    emailVerificationToken: v.optional(v.string()),
    password: v.string(),
    image: v.optional(v.string()),
    imageType: v.optional(v.string()),
    settingsSync: v.boolean(),
    settings: v.optional(v.any()), // JSON settings
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
  })
    .index("by_email", ["email"])
    .index("by_username", ["username"])
    .index("by_emailVerificationToken", ["emailVerificationToken"]),

  accounts: defineTable({
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
  })
    .index("by_userId", ["userId"])
    .index("by_provider_account", ["provider", "providerAccountId"]),

  sessions: defineTable({
    sessionToken: v.string(),
    userId: v.id("users"),
    expires: v.number(), // Unix timestamp
  })
    .index("by_sessionToken", ["sessionToken"])
    .index("by_userId", ["userId"]),

  verificationTokens: defineTable({
    identifier: v.string(),
    token: v.string(),
    expires: v.number(), // Unix timestamp
  })
    .index("by_token", ["token"])
    .index("by_identifier_token", ["identifier", "token"]),

  // Session tracking for rate limiting (replaces Redis)
  sessionTracking: defineTable({
    sessionToken: v.string(),
    hashedIp: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    requestCount: v.number(),
    expiresAt: v.number(), // Unix timestamp
    isActive: v.boolean(),
  })
    .index("by_sessionToken", ["sessionToken"])
    .index("by_hashedIp", ["hashedIp"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),
});
