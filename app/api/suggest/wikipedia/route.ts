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

async function suggestWikipediaArticle(query: string): Promise<{ article: string; language: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'mistralai/ministral-3b',
      temperature: 0.1, 
      max_tokens: 80,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful search assistant. The user will provide you with a search query, and you should respond with the best matching Wikipedia article name and the appropriate language code. Detect the language of the query and suggest the article from the corresponding Wikipedia. Respond in this exact format: ARTICLE_NAME|LANGUAGE_CODE (without quotes). Examples: "Artificial Intelligence|en" for English, "Türkiye|tr" for Turkish, "Deutschland|de" for German. Use 2-letter ISO language codes.'
        },
        {
          role: 'user',
          content: query,
        },
      ],
      stream: false,
    });

    const result = response.choices[0].message.content?.trim() || '';
    
    // Parse the response format "ARTICLE_NAME|LANGUAGE_CODE"
    const parts = result.split('|');
    if (parts.length === 2) {
      // Clean up any extra quotes or formatting issues
      const article = parts[0].trim().replace(/^["']|["']$/g, '');
      const language = parts[1].trim().replace(/^["']|["']$/g, '').toLowerCase();
      
      return {
        article: article,
        language: language
      };
    }
    
    // Fallback to English if parsing fails, clean up article name
    const cleanArticle = result.replace(/^["']|["']$/g, '');
    return {
      article: cleanArticle,
      language: 'en'
    };
  } catch (error) {
    console.error('Error suggesting Wikipedia article:', error);
    return {
      article: '',
      language: 'en'
    };
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
    const result = await suggestWikipediaArticle(query);
    
    if (!result.article) {
      return NextResponse.json({ error: 'Could not suggest a Wikipedia article for the provided query.' }, { status: 404 });
    }
    
    return NextResponse.json({ 
      article: result.article,
      language: result.language 
    });
  } catch (error: any) {
    console.error('Error in Wikipedia suggestion API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
