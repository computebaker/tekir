// Rate limiting configuration for API routes
export const RATE_LIMITS = {
  // Daily request limits
  ANONYMOUS_DAILY_LIMIT: 150,
  AUTHENTICATED_DAILY_LIMIT: 300,
  PLUS_DAILY_LIMIT: 600, // Tekir Plus members get significantly higher limits
  
  // Session configuration
  SESSION_EXPIRATION_HOURS: 24,
  SESSION_EXPIRATION_SECONDS: 24 * 60 * 60,

  // Rate limit reset time (daily)
  RESET_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
} as const;

// Helper function to get user-specific rate limit based on roles
export function getUserRateLimit(isAuthenticated: boolean, roles?: string[]): number {
  // Check if user has 'paid' role (Tekir Plus)
  if (roles && roles.some(role => role.toLowerCase() === 'paid')) {
    return RATE_LIMITS.PLUS_DAILY_LIMIT;
  }
  
  return isAuthenticated ? RATE_LIMITS.AUTHENTICATED_DAILY_LIMIT : RATE_LIMITS.ANONYMOUS_DAILY_LIMIT;
}

// Helper function to get session expiration
export function getSessionExpiration(): number {
  return RATE_LIMITS.SESSION_EXPIRATION_SECONDS;
}
