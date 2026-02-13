import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';
import { estimateTokens } from '@/lib/analytics-events';
import {
  trackServerAIError,
  flushServerEvents,
  trackLLMGeneration,
} from '@/lib/analytics-server';
import { WideEvent } from '@/lib/wide-event';
import { randomUUID } from 'crypto';

type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;

// Extended usage type for OpenRouter's response which includes cost
interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  // OpenRouter-specific: actual cost in USD
  cost?: number;
  // OpenRouter-specific: native token counts (before any conversion)
  native_tokens_prompt?: number;
  native_tokens_completion?: number;
  native_tokens_reasoning?: number;
}

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tekir.co',
    'X-Title': 'Tekir Search',
  },
});

const generationConfig = {
  temperature: 0,
  top_p: 0.95,
  max_tokens: 300,
  // Exclude reasoning tokens from response - ensures content is in message.content
  // Without this, models with reasoning capabilities may return empty content
  // and put reasoning in a separate field
  reasoning: {
    exclude: true,
  },
};

const SYSTEM_PROMPT = `You are Karakulak, a helpful AI agent working with Tekir search engine. Answer only.

Rules:
- Respond with the direct answer only. No prefaces, no apologies, no suggestions, no meta commentary, no questions back.
- Keep it concise and factual (short paragraph or shorter).
- If the input is unsupported, or disallowed, return an empty response.
- Try to give as much as context on a search term as possible, even when the search term isn't a full question or about a specific topic.
- Do not explain why you are refusing or why the input is not a question.`;

// Model configurations with their actual OpenRouter model IDs
const MODEL_CONFIG = {
  gemini: {
    id: 'google/gemini-3-flash-preview',
    provider: 'google',
  },
  llama: {
    id: 'meta-llama/llama-4-maverick',
    provider: 'meta',
  },
  mistral: {
    id: 'mistralai/ministral-8b-2512',
    provider: 'mistralai',
  },
  chatgpt: {
    id: 'openai/gpt-5-mini',
    provider: 'openai',
  },
  grok: {
    id: 'x-ai/grok-4-fast',
    provider: 'x-ai',
  },
  claude: {
    id: 'anthropic/claude-haiku-4.5',
    provider: 'anthropic',
  },
} as const;

type ModelKey = keyof typeof MODEL_CONFIG;

/**
 * Generic AI call function that returns the full API response
 * for proper usage tracking with PostHog LLM analytics
 */
async function callAI(
  modelKey: ModelKey,
  message: string
): Promise<ChatCompletionResponse> {
  const config = MODEL_CONFIG[modelKey];

  const response = await openai.chat.completions.create({
    model: config.id,
    ...generationConfig,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: message,
      },
    ],
    stream: false,
  });

  return response;
}

// Helper to get user ID from session
async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const sessionToken = req.cookies.get('session-token')?.value;
    if (!sessionToken) return null;

    const convex = getConvexClient();
    const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });
    return session?.userId || null;
  } catch {
    return null;
  }
}

// Helper to get full user data including name and avatar
interface UserData {
  id: string;
  name?: string;
  email?: string;
  image?: string;
}

async function getUserDataFromRequest(req: NextRequest): Promise<UserData | null> {
  try {
    const sessionToken = req.cookies.get('session-token')?.value;
    if (!sessionToken) return null;

    const convex = getConvexClient();
    const session = await convex.query(api.sessions.getSessionByToken, { token: sessionToken });
    if (!session?.userId) return null;

    // Fetch full user data
    const user = await convex.query(api.users.getUserById, { id: session.userId });
    if (!user) return null;

    return {
      id: user._id,
      name: user.name || user.username,
      email: user.email,
      image: user.image,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ model: string }> }) {
  // Generate a unique trace ID for this request
  const traceId = randomUUID();

  // Add security headers
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  const { model } = await params;
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: `/api/karakulak/${model}` });
  wideEvent.setCustom('trace_id', traceId);

  // Capture session token (used to attribute guest users) and
  // start fetching user data in background (don't await - it's non-critical)
  // This will be resolved by the time we send analytics, but won't block AI response
  const sessionToken = req.cookies.get('session-token')?.value;
  const userDataPromise = getUserDataFromRequest(req).catch(() => null);
  let userData: UserData | null = null;

  // Validate model parameter
  const validModels: ModelKey[] = ['gemini', 'llama', 'mistral', 'chatgpt', 'grok', 'claude'];
  const modelKey = model.toLowerCase() as ModelKey;

  if (!validModels.includes(modelKey)) {
    wideEvent.setError({ type: 'ValidationError', message: `Invalid model: ${model}`, code: 'invalid_model' });
    wideEvent.setAI({ model: modelKey, query_length: 0 });
    wideEvent.finish(400);

    return NextResponse.json({ error: `Model '${model}' is not supported` }, { status: 400, headers });
  }

  const rateLimitResult = await checkRateLimit(req, '/api/karakulak');
  if (!rateLimitResult.success) {
    wideEvent.setError({ type: 'RateLimitError', message: 'Rate limit exceeded', code: 'rate_limited' });
    wideEvent.setAI({ model: modelKey, query_length: 0 });
    wideEvent.finish(429);

    return rateLimitResult.response!;
  }

  const { message } = await req.json();

  // Input validation
  if (!message || typeof message !== 'string') {
    wideEvent.setError({ type: 'ValidationError', message: 'Invalid message input', code: 'invalid_message' });
    wideEvent.setAI({ model: modelKey, query_length: 0 });
    wideEvent.finish(400);

    return NextResponse.json({ error: 'Message is required and must be a string.' }, { status: 400, headers });
  }

  // Limit message length (400 characters as per search query limit)
  if (message.length > 400) {
    wideEvent.setError({ type: 'ValidationError', message: 'Message too long', code: 'message_too_long' });
    wideEvent.setAI({ model: modelKey, query_length: message.length });
    wideEvent.finish(400);

    return NextResponse.json({ error: 'Message too long. Maximum 400 characters allowed.' }, { status: 400, headers });
  }

  // Basic sanitization - remove excessive whitespace and potentially harmful characters
  const sanitizedMessage = message.trim().replace(/[\x00-\x1F\x7F]/g, '');

  if (!sanitizedMessage) {
    wideEvent.setError({ type: 'ValidationError', message: 'Message empty after sanitization', code: 'empty_message' });
    wideEvent.setAI({ model: modelKey, query_length: 0 });
    wideEvent.finish(400);

    return NextResponse.json({ error: 'Message cannot be empty after sanitization.' }, { status: 400, headers });
  }

  // Set initial AI context
  wideEvent.setAI({
    model: modelKey,
    query_length: sanitizedMessage.length,
    is_dive_mode: false,
  });

  // Start timing
  const t0 = Date.now();

  try {
    // Call the AI model and get full response
    const response = await callAI(modelKey, sanitizedMessage);

    const latency = Date.now() - t0;
    const answer = response.choices[0]?.message.content ?? '';
    const actualModel = response.model || MODEL_CONFIG[modelKey].id;
    
    // Get actual usage data from OpenRouter response (includes cost)
    const usage = response.usage as OpenRouterUsage | undefined;
    
    // Use actual token counts from API, fallback to estimates only if not available
    const queryTokens = usage?.prompt_tokens ?? estimateTokens(sanitizedMessage);
    const answerTokens = usage?.completion_tokens ?? estimateTokens(answer);
    const totalTokens = usage?.total_tokens ?? (queryTokens + answerTokens);
    
    // Use actual cost from OpenRouter if available (in USD), otherwise null
    const actualCost = usage?.cost ?? null;

    // Update AI context with response data
    wideEvent.setAI({
      model: modelKey,
      query_length: sanitizedMessage.length,
      response_length: answer.length,
      estimated_tokens: totalTokens,
      estimated_cost_cents: actualCost !== null ? actualCost * 100 : undefined,
      is_dive_mode: false,
    });
    wideEvent.setCustom('latency_ms', latency);
    wideEvent.setCustom('response_length', answer.length);
    wideEvent.setCustom('actual_model', actualModel);
    if (actualCost !== null) {
      wideEvent.setCustom('actual_cost_usd', actualCost);
    }
    wideEvent.finish(200);

    // Resolve user data with timeout (max 500ms) to ensure analytics don't block response
    try {
      userData = await Promise.race([
        userDataPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 500))
      ]);
    } catch {
      userData = null;
    }

    // Build analytics identity: prefer logged-in user, else attribute to guest session if available
    let analyticsDistinctId: string | undefined = undefined;
    let analyticsUserName: string | undefined = undefined;
    if (userData && userData.id) {
      analyticsDistinctId = userData.id;
      analyticsUserName = userData.name;
    } else if (sessionToken) {
      // Use a deterministic guest id derived from the session token (shortened)
      analyticsDistinctId = `guest_${sessionToken.slice(0, 8)}`;
      analyticsUserName = 'Guest';
    }

    // Track with native PostHog LLM analytics
    trackLLMGeneration({
      $ai_provider: MODEL_CONFIG[modelKey].provider,
      $ai_model: actualModel,
      $ai_input: sanitizedMessage,
      $ai_output: answer,
      $ai_latency: latency,
      $ai_tokens_input: queryTokens,
      $ai_tokens_output: answerTokens,
      $ai_tokens_total: totalTokens,
      $ai_total_cost_usd: actualCost ?? undefined,
      $ai_trace_id: traceId,
      $ai_temperature: generationConfig.temperature,
      $ai_max_tokens: generationConfig.max_tokens,
      user_id: analyticsDistinctId || undefined,
      user_name: analyticsUserName || userData?.name || undefined,
      user_email: userData?.email || undefined,
      user_avatar: userData?.image || undefined,
    });

    // Fire-and-forget AI usage logging to Convex
    try {
      const convex = getConvexClient();
      await convex.mutation(api.usage.logAiUsage, {
        model: modelKey,
        latencyMs: latency,
        answerChars: answer.length,
      });
    } catch (e) {
      // Non-critical, continue
    }

    // Return response with analytics metadata
    const jsonResponse = NextResponse.json(
      {
        answer,
        // Include actual usage data from OpenRouter API
        _analytics: {
          model: modelKey,
          actual_model: actualModel,
          query_length: sanitizedMessage.length,
          response_length: answer.length,
          response_time_ms: latency,
          tokens_input: queryTokens,
          tokens_output: answerTokens,
          tokens_total: totalTokens,
          // Actual cost from OpenRouter API in USD (null if not available)
          cost: actualCost,
          trace_id: traceId,
        },
      },
      { headers }
    );

    // Flush analytics events after response is sent
    jsonResponse.headers.set('X-Analytics-Flush', 'true');
    flushServerEvents().catch((err) => {
      // Suppress warning in production
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PostHog] Failed to flush events:', err);
      }
    });

    return jsonResponse;
  } catch (error: any) {
    const latency = Date.now() - t0;

    wideEvent.setError({
      type: error.name || 'APIError',
      message: error.message || 'AI API request failed',
      code: 'api_error',
      domain: 'upstream_api',
      retriable: true,
    });
    wideEvent.finish(500);

    // Track server-side AI error
    trackServerAIError({
      model: modelKey,
      error_type: error.name || 'APIError',
      is_dive_mode: false,
    });
    flushServerEvents().catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PostHog] Failed to flush events:', err);
      }
    });

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers });
  }
}
