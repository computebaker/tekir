import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { api } from '@/convex/_generated/api';
import { getConvexClient } from '@/lib/convex-client';

export async function POST(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const convex = getConvexClient();
  try {
    const result = await convex.mutation(api.usage.purgeAnalytics, {} as any);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to purge analytics' }, { status: 500 });
  }
}
