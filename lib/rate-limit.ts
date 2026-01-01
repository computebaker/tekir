import { NextRequest, NextResponse } from 'next/server';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Unique identifier for the rate limit (e.g., 'signin', 'signup') */
  keyPrefix: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Number of requests made in the current window */
  count: number;
  /** When the limit will reset (Unix timestamp) */
  resetAt: number;
}

/**
 * Rate limit error response headers
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

/**
 * Get client identifier from request
 * Uses session token if available, falls back to IP address
 */
async function getClientIdentifier(req: NextRequest): Promise<string> {
  // Try to get session token from cookie first
  const sessionToken = req.cookies.get('session-token')?.value;
  if (sessionToken) {
    return `session:${sessionToken}`;
  }

  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() :
             req.headers.get('x-real-ip') ||
             'unknown';

  return `ip:${ip}`;
}

/**
 * Check rate limit using Convex
 * Returns rate limit result and sets appropriate headers on response
 */
export async function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<{ allowed: boolean; headers: RateLimitHeaders }> {
  try {
    const identifier = await getClientIdentifier(req);
    const convex = getConvexClient();

    // Check if rate limit module exists in Convex
    // Fail closed in production for security, but allow in development for better UX
    const result = await convex.mutation(api.rateLimit.checkLimit, {
      identifier,
      keyPrefix: config.keyPrefix,
      maxRequests: config.maxRequests,
      windowMs: config.windowMs
    }).catch((error) => {
      // If rate limit check fails, block in production but allow in development
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (!isDevelopment) {
        console.error('Rate limiting check failed, blocking request for security:', error);
        return { success: false, count: config.maxRequests, resetAt: Date.now() + config.windowMs };
      }
      // Development: allow the request and log the error
      console.warn('Rate limiting check failed in development, allowing request:', error);
      return { success: true, count: 0, resetAt: Date.now() + config.windowMs };
    });

    const remaining = Math.max(0, config.maxRequests - result.count);
    const resetAt = Math.ceil(result.resetAt / 1000);

    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetAt.toString()
    };

    if (!result.success) {
      headers['Retry-After'] = Math.ceil((result.resetAt - Date.now()) / 1000).toString();
    }

    return { allowed: result.success, headers };
  } catch (error) {
    // If rate limiting fails, block in production for security
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (!isDevelopment) {
      console.error('Rate limiting error, blocking request:', error);
      // Block the request in production
      const headers: RateLimitHeaders = {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil((Date.now() + config.windowMs) / 1000).toString(),
        'Retry-After': Math.ceil(config.windowMs / 1000).toString()
      };
      return { allowed: false, headers };
    }

    // Development: allow the request and log the error
    console.error('Rate limiting error in development, allowing request:', error);
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': config.maxRequests.toString(),
      'X-RateLimit-Reset': Math.ceil((Date.now() + config.windowMs) / 1000).toString()
    };

    return { allowed: true, headers };
  }
}

/**
 * Apply rate limit to a Next.js API route
 * Returns the response if rate limited, null if allowed
 */
export async function applyRateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const { allowed, headers } = await checkRateLimit(req, config);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: Object.entries(headers).reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>)
      }
    );
  }

  return null;
}

/**
 * Predefined rate limit configurations for common endpoints
 */
export const RateLimitPresets = {
  /** Strict rate limit for authentication endpoints */
  auth: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'auth'
  } as RateLimitConfig,

  /** Moderate rate limit for API endpoints */
  api: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'api'
  } as RateLimitConfig,

  /** Lenient rate limit for general endpoints */
  general: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'general'
  } as RateLimitConfig
};
