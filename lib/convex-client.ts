import { ConvexHttpClient } from "convex/browser";
import { trackServerLog } from "@/lib/analytics-server";

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
const convexHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_CONVEX_URL || '').host || 'unknown';
  } catch {
    return 'unknown';
  }
})();

trackServerLog('convex_client_initialized', {
  convex_host: convexHost,
  has_convex_url: Boolean(process.env.NEXT_PUBLIC_CONVEX_URL),
  timestamp: new Date().toISOString(),
});
