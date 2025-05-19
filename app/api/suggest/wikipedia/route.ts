import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, isRedisConfigured, incrementAndCheckRequestCount } from '@/lib/redis';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tekir.co',
    'X-Title': 'Tekir Search',
  },
});

async function suggestWikipediaArticle(query: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'mistralai/ministral-3b',
      temperature: 0.1, 
      max_tokens: 50,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful search assist program. The user will provide you with a search query, and you will try to provide them with the best matching Wikipedia article that you know is real on the English Wikipedia. You should STRICTLY only give the article name, nothing more. \n\nThe user has provided this string:'
        },
        {
          role: 'user',
          content: query,
        },
      ],
      stream: false,
    });

    const article = response.choices[0].message.content?.trim() || '';
    
    return article;
  } catch (error) {
    console.error('Error suggesting Wikipedia article:', error);
    return '';
  }
}

export async function GET(req: NextRequest) {
  if (isRedisConfigured) {
    const sessionToken = req.cookies.get('session-token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session token.' }, { status: 401 });
    }
    const isValid = await isValidSessionToken(sessionToken);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired session token.' }, { status: 403 });
    }
    const { allowed, currentCount } = await incrementAndCheckRequestCount(sessionToken);
    if (!allowed) {
      console.warn(`Session token ${sessionToken} exceeded request limit for /api/suggest/wikipedia. Count: ${currentCount}`);
      return NextResponse.json({ error: 'Request limit exceeded for this session.' }, { status: 429 });
    }
  } else {
    console.warn("Redis is not configured. Skipping session token validation and request counting for /api/suggest/wikipedia. This should be addressed in production.");
  }

  const query = req.nextUrl.searchParams.get('q');
  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }

  try {
    const article = await suggestWikipediaArticle(query);
    
    if (!article) {
      return NextResponse.json({ error: 'Could not suggest a Wikipedia article for the provided query.' }, { status: 404 });
    }
    
    return NextResponse.json({ article });
  } catch (error: any) {
    console.error('Error in Wikipedia suggestion API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
