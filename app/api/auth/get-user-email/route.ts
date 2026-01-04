import { NextRequest, NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convex-client";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { randomUUID } from 'crypto';

const getUserEmailSchema = z.object({
  username: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/auth/get-user-email' });
  wideEvent.setCustom('trace_id', traceId);
  
  try {
    const body = await request.json();
    const { username } = getUserEmailSchema.parse(body);
    
    wideEvent.setCustom('username_length', username.length);

    const convex = getConvexClient();

    // Find user by username
    const user = await convex.query(api.users.getUserByUsername, { username });

    if (!user) {
      wideEvent.setError({ type: 'AuthError', message: 'User not found', code: 'user_not_found' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(404);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    wideEvent.setUser({ id: user._id });
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json(
      { email: user.email },
      { status: 200 }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof z.ZodError) {
      wideEvent.setError({ type: 'ValidationError', message: 'Invalid input', code: 'validation_error' });
      wideEvent.setCustom('latency_ms', duration);
      wideEvent.finish(400);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    if (process.env.NODE_ENV === 'development') {
      console.error("Get user email error:", error);
    }
    
    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Failed to get user email', code: 'get_email_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    
    return NextResponse.json(
      { error: "Failed to get user email" },
      { status: 500 }
    );
  }
}
