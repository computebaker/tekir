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
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const users = await convex.query(api.users.listUsers, { authToken, limit });
  return NextResponse.json({ results: users });
}

export async function DELETE(request: NextRequest) {
  const forbidden = await requireAdmin(request);
  if (forbidden) return forbidden;

  const authToken = request.cookies.get('auth-token')?.value;
  // Should never happen if requireAdmin passed, but keep defensive.
  if (!authToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const convex = getConvexClient();
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await convex.mutation(api.users.deleteUser, { authToken, id });
  return NextResponse.json({ success: true });
}
