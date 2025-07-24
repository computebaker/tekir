import { ConvexReactClient } from "convex/react";
import { ConvexHttpClient } from "convex/browser";

// Configuration for Convex proxy
const CONVEX_CONFIG = {
  // Use proxy in production to hide deployment URL
  useProxy: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_USE_CONVEX_PROXY === 'true',
  
  // Proxy endpoint through your domain
  proxyUrl: process.env.NEXT_PUBLIC_CONVEX_PROXY_URL || '/api/convex',
  
  // Direct Convex URL (fallback)
  directUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
};

function getConvexUrl(): string {
  if (CONVEX_CONFIG.useProxy) {
    // Use proxy URL (your domain)
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    return `${baseUrl}${CONVEX_CONFIG.proxyUrl}`;
  }
  
  // Use direct URL
  if (!CONVEX_CONFIG.directUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }
  
  return CONVEX_CONFIG.directUrl;
}

// Enhanced ConvexReactClient with proxy support
class ProxiedConvexReactClient extends ConvexReactClient {
  constructor() {
    const url = getConvexUrl();
    console.log(`Convex client connecting to: ${CONVEX_CONFIG.useProxy ? 'proxy' : 'direct'} - ${url}`);
    
    super(url, {
      // Additional options for proxy support
      verbose: process.env.NODE_ENV === 'development',
    });
  }
}

// Enhanced ConvexHttpClient with proxy support  
class ProxiedConvexHttpClient extends ConvexHttpClient {
  constructor() {
    const url = getConvexUrl();
    console.log(`Convex HTTP client connecting to: ${CONVEX_CONFIG.useProxy ? 'proxy' : 'direct'} - ${url}`);
    
    super(url);
  }
}

// Create clients
export const convexReactClient = new ProxiedConvexReactClient();
export const convexHttpClient = new ProxiedConvexHttpClient();

// Default export for backward compatibility
export default convexReactClient;

// Helper function for server-side use
export function getConvexClient() {
  return convexHttpClient;
}

// Configuration helper
export function getConvexConfig() {
  return {
    ...CONVEX_CONFIG,
    activeUrl: getConvexUrl(),
    isProxied: CONVEX_CONFIG.useProxy,
  };
}
