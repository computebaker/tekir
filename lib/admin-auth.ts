import { NextRequest, NextResponse } from 'next/server';
import { getJWTUser } from '@/lib/jwt-auth';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';

export async function requireAdmin(request: NextRequest) {
  try {
    const jwtUser = await getJWTUser(request);
    if (!jwtUser?.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Always validate against the latest roles from the DB to avoid stale JWT claims
    const convex = getConvexClient();
    const user = await convex.query(api.users.getUserById, { id: jwtUser.userId as any });
    const roles = (user?.roles ?? []) as string[];
    const isAdmin = Array.isArray(roles) && roles.includes('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return null;
  } catch (err) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
