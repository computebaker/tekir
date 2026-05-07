import { NextRequest } from 'next/server';
import { withAPIObservability } from '@/lib/api-observability';

async function POSTHandler(req: NextRequest) {
  return Response.json({ response: "Chat has been shut down." });
}

export const POST = withAPIObservability(POSTHandler);
