import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { getConvexClient } from '@/lib/convex-client';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const authToken = request.cookies.get('auth-token')?.value;
  // Should never happen if requireAdmin passed, but keep defensive.
  if (!authToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const convex = getConvexClient();
  const [users, feedbacks] = await Promise.all([
    convex.query(api.users.countUsers, { authToken }),
    convex.query(api.feedbacks.countFeedbacks, {}),
  ]);

  return NextResponse.json({ users, feedbacks });
}
