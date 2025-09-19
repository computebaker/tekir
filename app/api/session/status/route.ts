import { NextRequest, NextResponse } from 'next/server';
import { getRateLimitStatus } from '@/lib/convex-session';
import { getUserRateLimit } from '@/lib/rate-limits';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Session token required' }, { status: 401 });
    }

    const s: any = await getRateLimitStatus(token);
    if (!s || !s.isValid) {
      return NextResponse.json({ error: 'Invalid or expired session token' }, { status: 401 });
    }

    const isAuthed = !!s.isAuthenticated;
    const limit = typeof s.limit === 'number' ? s.limit : getUserRateLimit(isAuthed);
    const current = typeof s.currentCount === 'number' ? s.currentCount : 0;
    const remainingRaw = typeof s.remaining === 'number' ? s.remaining : (limit - current);
    const remaining = Math.max(0, remainingRaw);

    return NextResponse.json({
      limit,
      remaining,
      currentCount: current,
      isAuthenticated: !!s.isAuthenticated,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
