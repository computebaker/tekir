import { OpenAI } from 'openai';
import { NextRequest } from 'next/server';
import { headers } from 'next/headers';

// Change from force-static to force-dynamic
export const dynamic = "force-dynamic";

// Initialize OpenAI SDK with OpenRouter API
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_HOST || 'https://tekir.co',
    'X-Title': 'Tekir Chat'
  }
});

// Define model mapping for OpenRouter
const modelMapping: Record<string, string> = {
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'llama-3-1-80b': 'meta-llama/llama-3.3-70b-instruct',
  'gemini-2.0-flash': 'google/gemini-2.0-flash-001'
};

// Rate limiting implementation
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit settings
const RATE_LIMIT_MAX = 60; // 60 messages
const RATE_LIMIT_WINDOW_HOURS = 12; // per 12 hours
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;

// Function to get client IP address from request
function getClientIp(req: NextRequest): string {
  // Try to get IP from Cloudflare or other proxy headers first
  const headersList = headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // Fall back to request IP
  return req.ip || '127.0.0.1';
}

// Check if a request is rate limited
function isRateLimited(req: NextRequest): { limited: boolean; remaining: number; resetAt: number | null } {
  const ip = getClientIp(req);
  const now = Date.now();
  
  // Clean up expired entries
  rateLimitStore.forEach((entry, storedIp) => {
    if (entry.resetAt < now) {
      rateLimitStore.delete(storedIp);
    }
  });
  
  let entry = rateLimitStore.get(ip);
  
  // If no entry exists or it's expired, create a new one
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    };
    rateLimitStore.set(ip, entry);
    return { limited: false, remaining: RATE_LIMIT_MAX - 1, resetAt: entry.resetAt };
  }
  
  // If under the limit, increment and allow
  if (entry.count < RATE_LIMIT_MAX) {
    entry.count++;
    return { limited: false, remaining: RATE_LIMIT_MAX - entry.count, resetAt: entry.resetAt };
  }
  
  // Otherwise, rate limited
  return { limited: true, remaining: 0, resetAt: entry.resetAt };
}

export async function POST(req: NextRequest) {
  try {
    // Check rate limit before processing the request
    const rateLimitResult = isRateLimited(req);
    if (rateLimitResult.limited) {
      const resetDate = rateLimitResult.resetAt ? new Date(rateLimitResult.resetAt).toISOString() : null;
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `You've reached the limit of ${RATE_LIMIT_MAX} messages per ${RATE_LIMIT_WINDOW_HOURS} hours.`,
          resetAt: resetDate
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt?.toString() || '',
          }
        }
      );
    }
    
    // Parse the request body
    const { messages, model } = await req.json();

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response('Messages are required and must be an array', { status: 400 });
    }

    // Map to OpenRouter model ID
    const openRouterModel = modelMapping[model] || modelMapping['llama-3-1-80b']; // Default to llama

    // Start the OpenAI completion
    const response = await openai.chat.completions.create({
      model: openRouterModel,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content
      })),
      stream: true,
      temperature: 0.7
    });

    // Convert the response to a readable stream with correct headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Process the stream from OpenAI
        try {
          // Using async iteration to process the stream
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (e) {
          console.error('Error processing stream:', e);
        } finally {
          controller.close();
        }
      }
    });

    // Return the stream as a Response with rate limit headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetAt?.toString() || '',
      },
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An error occurred during chat completion' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
