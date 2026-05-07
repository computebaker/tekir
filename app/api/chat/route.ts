import { NextRequest, NextResponse } from 'next/server';
import { withAPIObservability } from '@/lib/api-observability';

async function POSTHandler(req: NextRequest) {
  return NextResponse.json({ message: 'Chat has been disabled.' });
}

export const POST = withAPIObservability(POSTHandler);
