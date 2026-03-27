import { createChallenge } from 'ribaunt';
import { NextRequest, NextResponse } from 'next/server';
import { handleAPIError } from '@/lib/api-error-tracking';

export async function GET(request: NextRequest) {
  try {
    const challenges = createChallenge(3, 3, 100);

    return NextResponse.json({ challenges });
  } catch (error) {
    return handleAPIError(error, request, '/api/captcha/challenge', 'GET', 500);
  }
}
