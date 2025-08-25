import { NextRequest, NextResponse } from 'next/server';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';
import { isValidSessionToken, incrementAndCheckRequestCount } from '@/lib/convex-session';

export async function POST(req: NextRequest) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };

  const sessionToken = req.cookies.get('session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Missing session token.' }, { status: 401, headers });
  }

  const valid = await isValidSessionToken(sessionToken);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or expired session token.' }, { status: 403, headers });
  }

  // Optional rate limiting: increment request count
  try {
    const { allowed } = await incrementAndCheckRequestCount(sessionToken);
    if (!allowed) {
      return NextResponse.json({ error: 'Request limit exceeded.' }, { status: 429, headers });
    }
  } catch (e) {
    // ignore rate-limit errors and proceed
    console.warn('Rate limit check failed for feedback endpoint', e);
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
      sessionToken,
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
