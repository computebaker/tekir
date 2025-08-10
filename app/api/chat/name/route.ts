import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getJWTUser } from '@/lib/jwt-auth';

const openai = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: NextRequest) {
  const jwtUser = await getJWTUser(req);
  if (!jwtUser) return new Response('Unauthorized', { status: 401 });

  const { text, model = 'openai/gpt-4o-mini' } = await req.json();
  if (!text || typeof text !== 'string') return new Response('Bad Request', { status: 400 });

  const prompt = `Generate a short, catchy chat title in <= 3 words for this first message. Return only the title, no quotes or punctuation.\nMessage: ${text}`;
  const res = await generateText({ model: openai(model), prompt });
  const title = res.text.trim().replace(/^\"|\"$/g, '').slice(0, 60);
  return Response.json({ title });
}
