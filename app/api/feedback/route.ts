import { NextRequest, NextResponse } from 'next/server';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/feedback' });
  wideEvent.setCustom('trace_id', traceId);

  const rateLimitResult = await checkRateLimit(req, '/api/feedback');
  if (!rateLimitResult.success) {
    wideEvent.setError({ type: 'RateLimitError', message: 'Rate limit exceeded', code: 'rate_limited' });
    wideEvent.finish(429);
    return rateLimitResult.response!;
  }

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    wideEvent.setError({ type: 'ValidationError', message: 'Invalid JSON', code: 'invalid_json' });
    wideEvent.finish(400);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }

  // Basic validation
  const liked = !!body.liked;
  const comment = typeof body.comment === 'string' ? body.comment : undefined;
  const queryStr = typeof body.query === 'string' ? body.query : (body.query || '');

  wideEvent.setCustom('feedback_liked', liked);
  wideEvent.setCustom('query_length', queryStr.length);
  wideEvent.setCustom('search_type', body.searchType);
  wideEvent.setCustom('search_engine', body.searchEngine);
  wideEvent.setCustom('has_comment', !!comment);

  const convex = getConvexClient();
  try {
  await convex.mutation((api as any).feedbacks.createFeedback, {
      userId: body.userId || undefined,
  sessionToken: req.cookies.get('session-token')?.value,
      query: queryStr,
      searchEngine: body.searchEngine,
      searchType: body.searchType,
      results: body.results || undefined,
      wikipedia: body.wikipedia || undefined,
      autocomplete: body.autocomplete || undefined,
      karakulak: body.karakulak || undefined,
      liked,
      comment,
    });

    const duration = Date.now() - startTime;
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(200);
    
    flushServerEvents().catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PostHog] Failed to flush events:', err);
      }
    });

    return NextResponse.json({ success: true }, { headers });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    wideEvent.setError({
      type: error.name || 'FeedbackError',
      message: error.message || 'Failed to save feedback',
      code: 'feedback_save_failed',
    });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    
    flushServerEvents().catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[PostHog] Failed to flush events:', err);
      }
    });

    console.error('Failed to save feedback:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500, headers });
  }
}
