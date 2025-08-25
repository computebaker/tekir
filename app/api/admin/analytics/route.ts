import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { getConvexClient } from '@/lib/convex-client';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const convex = getConvexClient();
  const [users, feedbacks] = await Promise.all([
    convex.query(api.users.countUsers, {}),
    convex.query(api.feedbacks.countFeedbacks, {}),
  ]);

  return NextResponse.json({ users, feedbacks });
}
