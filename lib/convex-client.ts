import { ConvexHttpClient } from "convex/browser";

// For server-side use, always use direct URL (no proxy needed)
if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
}

export const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Helper function to get Convex client for server-side use
export function getConvexClient() {
  return convexClient;
}

// Log configuration for debugging (with hidden URL)
console.log('Server Convex client initialized:', {
  url: process.env.NEXT_PUBLIC_CONVEX_URL,
  timestamp: new Date().toISOString()
});
