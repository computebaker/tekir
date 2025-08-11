import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { api } from '@/convex/_generated/api';
import { getConvexClient } from '@/lib/convex-client';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tekir.co',
    'X-Title': 'Tekir Search',
  },
});

// Format current date as YYYY-MM-DD
function getIsoDateKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Human readable date label like "August 11th, 2025"
function getHumanDateLabel(date = new Date()): string {
  const day = date.getUTCDate();
  const suffix = (n: number) => {
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  };
  const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(date);
  const year = date.getUTCFullYear();
  return `${month} ${day}${suffix(day)}, ${year}`;
}

async function generateRecommendations(todayLabel: string): Promise<string[]> {
  const system = `You are an AI agent responsible for creating "recommended search" options for users of a privacy related search engine. Every time you are invoked, you will create 8 different recommended search options for users. You will return this as a json file like this:

["item1","item2","item3","item4","item5","item6","item7","item8"]

You can return things like remarkable events that happened today, special days (like fathers day, mothers day, cats day etc.) that are global.

Make the generated items look like casual searches, like "Mother's day", "How to stay private online", "Privacy guides", "Best AI models" etc. Do not add dates at the end of the searches. "Top messaging apps 2025" is wrong. Do not add a year at the end of the terms you provide.

Beware of caps lock. "It should be formatted like this".

Make sure the day of the special day you are going to give is matching the current one. So do not give me "International Cat's Day" in a random date, it should be on its own day.

Try not to be politic. Prefer using international days where possible.

Today's date is:
-${todayLabel} generated on request-`;

  const response = await openai.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0,
    top_p: 0.95,
    max_tokens: 300,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: 'Generate the list now. Return only the JSON array, nothing else.' },
    ],
    stream: false,
  });

  const content = response.choices[0]?.message?.content?.trim() ?? '';
  // Attempt to parse JSON array
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    // Try to extract array from code fences if present
    const match = content.match(/\[([\s\S]*)\]/);
    if (!match) throw new Error('Model did not return a JSON array');
    parsed = JSON.parse(`[${match[1]}]`);
  }

  if (!Array.isArray(parsed)) throw new Error('Invalid response: not an array');
  const items = (parsed as unknown[])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((s): s is string => !!s)
    .slice(0, 8);

  if (items.length !== 8) throw new Error('Expected 8 items');
  return items;
}

export async function GET(_req: NextRequest) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  } as const;

  const convex = getConvexClient();
  const dateKey = getIsoDateKey();
  const dateLabel = getHumanDateLabel();

  try {
    // Return cached for today if exists
    const existing = await convex.query(api.recommendations.getByDate, { date: dateKey });
    if (existing?.items?.length === 8) {
      return NextResponse.json({ results: existing.items, date: existing.date, dateLabel: existing.dateLabel }, { headers: { ...headers } });
    }

    // Generate fresh
    const items = await generateRecommendations(dateLabel);

    await convex.mutation(api.recommendations.upsertForDate, {
      date: dateKey,
      dateLabel,
      items,
    });

    return NextResponse.json({ results: items, date: dateKey, dateLabel }, { headers: { ...headers } });
  } catch (error: any) {
    console.error('Error in /api/recommend:', error);

    // Fallback: if we have latest recommendations, return them with 206
    try {
      const latest = await convex.query(api.recommendations.getLatest, {});
      if (latest?.items?.length) {
        return NextResponse.json(
          { results: latest.items, date: latest.date, dateLabel: latest.dateLabel, stale: true },
          { status: 206, headers: { ...headers } }
        );
      }
    } catch {}

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers: { ...headers } });
  }
}
