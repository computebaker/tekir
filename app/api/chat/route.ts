import { NextRequest, NextResponse } from 'next/server';
import { streamText, convertToCoreMessages } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getJWTUser } from '@/lib/jwt-auth';
import { isValidSessionToken, incrementAndCheckRequestCount } from '@/lib/convex-session';

const openai = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Require authentication
  const jwtUser = await getJWTUser(req);
  if (!jwtUser) {
    return new Response('Unauthorized', { status: 401 });
    }

  // Session token validation and rate limiting (align with existing Karakulak API)
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  } as Record<string, string>;

  const sessionToken = req.cookies.get('session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Missing session token.' }, { status: 401, headers });
  }
  const valid = await isValidSessionToken(sessionToken);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or expired session token.' }, { status: 403, headers });
  }
  const { allowed, currentCount } = await incrementAndCheckRequestCount(sessionToken);
  if (!allowed) {
    return NextResponse.json(
      {
        error: 'Request limit exceeded for this session.',
        currentCount,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      { status: 429, headers }
    );
  }

  const body = await req.json();
  const { messages, model = 'openai/gpt-4o-mini' } = body || {};

  const result = await streamText({
    model: openai(model),
    messages: convertToCoreMessages(messages ?? []),
    onFinish({ response }) {
      // Attach token usage headers for the client if available
      const usage = (response as any).usage;
      if (usage) {
        // no-op here; client can read from stream metadata if needed
      }
    },
  });

  return result.toDataStreamResponse();
}
