import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Types for messages used by UI and API
export const ChatMessage = v.object({
  id: v.string(),
  role: v.string(),
  content: v.any(),
  createdAt: v.number(),
  model: v.optional(v.string()),
  toolCalls: v.optional(v.any()),
  tokensIn: v.optional(v.number()),
  tokensOut: v.optional(v.number()),
});

// List user's chats (most recent first)
export const list = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit = 50 }) => {
    const items = await ctx.db
      .query("chats")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    return items;
  },
});

// Get a chat by id (ensures ownership)
export const get = query({
  args: { id: v.id("chats"), userId: v.id("users") },
  handler: async (ctx, { id, userId }) => {
    const chat = await ctx.db.get(id);
    if (!chat || chat.userId !== userId) return null;
    return chat;
  },
});

// Create a new empty chat
export const create = mutation({
  args: {
    userId: v.id("users"),
    title: v.optional(v.string()),
    model: v.optional(v.string()),
    firstMessages: v.optional(v.array(ChatMessage)),
  },
  handler: async (ctx, { userId, title, model, firstMessages }) => {
    const now = Date.now();
    const messages = firstMessages ?? [];
    const id = await ctx.db.insert("chats", {
      userId,
      title,
      model,
      messages,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Append messages and update title optionally
export const appendMessages = mutation({
  args: {
    id: v.id("chats"),
    userId: v.id("users"),
    messages: v.array(ChatMessage),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { id, userId, messages, title }) => {
    const chat = await ctx.db.get(id);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.patch(id, {
      messages: [...chat.messages, ...messages],
      title: title ?? chat.title,
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const rename = mutation({
  args: { id: v.id("chats"), userId: v.id("users"), title: v.string() },
  handler: async (ctx, { id, userId, title }) => {
    const chat = await ctx.db.get(id);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.patch(id, { title, updatedAt: Date.now() });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("chats"), userId: v.id("users") },
  handler: async (ctx, { id, userId }) => {
    const chat = await ctx.db.get(id);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== userId) throw new Error("Unauthorized");
    await ctx.db.delete(id);
    return id;
  },
});

// Update metadata for a single message within a chat
export const updateMessage = mutation({
  args: {
    id: v.id("chats"),
    userId: v.id("users"),
    messageId: v.string(),
    patch: v.object({
      model: v.optional(v.string()),
      toolCalls: v.optional(v.any()),
      tokensIn: v.optional(v.number()),
      tokensOut: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { id, userId, messageId, patch }) => {
    const chat = await ctx.db.get(id);
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== userId) throw new Error("Unauthorized");

    const updated = chat.messages.map((m: any) =>
      m.id === messageId ? { ...m, ...patch } : m
    );

    await ctx.db.patch(id, { messages: updated, updatedAt: Date.now() });
    return id;
  },
});
