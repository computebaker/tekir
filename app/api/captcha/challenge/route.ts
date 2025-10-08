import { createChallenge } from '@ribaunt/tools';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Generate 3 challenges with difficulty 60, valid for 5 minutes
    const challenges = createChallenge(3, 60, 300);
    
    return NextResponse.json({ challenges });
  } catch (error) {
    console.error('Failed to create challenge:', error);
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}
