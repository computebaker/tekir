import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/convex/_generated/api';
import { getConvexClient } from '@/lib/convex-client';
import { requireAdmin } from '@/lib/admin-auth';
import { handleAPIError } from '@/lib/api-error-tracking';

export async function GET(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const authToken = request.cookies.get('auth-token')?.value;
  // Should never happen if requireAdmin passed, but keep defensive.
  if (!authToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const convex = getConvexClient();
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const items = await convex.query(api.feedbacks.listFeedbacks, { authToken, limit });
    return NextResponse.json({ results: items });
  } catch (error) {
    return handleAPIError(error, request, '/api/admin/feedback', 'GET', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const authToken = request.cookies.get('auth-token')?.value;
  // Should never happen if requireAdmin passed, but keep defensive.
  if (!authToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const convex = getConvexClient();
    const { id } = await request.json();
    if (!id) {
      return handleAPIError(
        new Error('id required'),
        request,
        '/api/admin/feedback',
        'DELETE',
        400
      );
    }
    await convex.mutation(api.feedbacks.deleteFeedback, { authToken, id });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error, request, '/api/admin/feedback', 'DELETE', 500);
  }
}
