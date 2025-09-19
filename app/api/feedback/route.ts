import { NextRequest, NextResponse } from 'next/server';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';
import { checkRateLimit } from '@/lib/rate-limit-middleware';

export async function POST(req: NextRequest) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  const rateLimitResult = await checkRateLimit(req, '/api/feedback');
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }

  // Basic validation
  const liked = !!body.liked;
  const comment = typeof body.comment === 'string' ? body.comment : undefined;
  const queryStr = typeof body.query === 'string' ? body.query : (body.query || '');

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

    return NextResponse.json({ success: true }, { headers });
  } catch (error: any) {
    console.error('Failed to save feedback:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500, headers });
  }
}
