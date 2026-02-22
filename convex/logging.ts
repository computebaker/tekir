"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { PostHog } from "posthog-node";

let posthog: PostHog | null = null;

const getPosthog = () => {
  if (posthog) return posthog;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
  if (!key) return null;
  posthog = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return posthog;
};

export const logServerEvent = internalAction({
  args: {
    level: v.string(),
    message: v.string(),
    metadataJson: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const client = getPosthog();
    if (!client) return null;

    const metadata = args.metadataJson ? { metadata_json: args.metadataJson } : {};

    client.capture({
      distinctId: "convex",
      event: "convex_log",
      properties: {
        level: args.level,
        message: args.message,
        source: "convex",
        ...metadata,
      },
    });

    await client.flush();
    return null;
  },
});
