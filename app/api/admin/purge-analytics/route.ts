import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { api } from '@/convex/_generated/api';
import { getConvexClient } from '@/lib/convex-client';
import { handleAPIError } from '@/lib/api-error-tracking';

export async function POST(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const convex = getConvexClient();
  try {
    const authToken = request.cookies.get('auth-token')?.value;
    if (!authToken) {
      return handleAPIError(
        new Error('Missing auth token'),
        request,
        '/api/admin/purge-analytics',
        'POST',
        401
      );
    }
    const result = await convex.mutation(api.usage.purgeAnalytics, { authToken } as any);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleAPIError(error, request, '/api/admin/purge-analytics', 'POST', 500);
  }
}
