import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import OpenAI from 'openai';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { handleAPIError } from '@/lib/api-error-tracking';
import { randomUUID } from 'crypto';

// Country code to language code mapping for Wikipedia
const COUNTRY_TO_LANGUAGE: Record<string, string> = {
  'AR': 'es',
  'AU': 'en',
  'AT': 'de',
  'BE': 'nl',
  'BR': 'pt',
  'CA': 'en',
  'CL': 'es',
  'DK': 'da',
  'FI': 'fi',
  'FR': 'fr',
  'DE': 'de',
  'HK': 'zh',
  'IN': 'en',
  'ID': 'id',
  'IT': 'it',
  'JP': 'ja',
  'KR': 'ko',
  'MY': 'en',
  'MX': 'es',
  'NL': 'nl',
  'NZ': 'en',
  'NO': 'no',
  'CN': 'zh',
  'PL': 'pl',
  'PT': 'pt',
  'PH': 'en',
  'RU': 'ru',
  'SA': 'ar',
  'ZA': 'en',
  'ES': 'es',
  'SE': 'sv',
  'CH': 'de',
  'TW': 'zh',
  'TR': 'tr',
  'GB': 'en',
  'US': 'en',
  'ALL': 'en'
};

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tekir.co',
    'X-Title': 'Tekir Search',
  },
});

async function suggestWikipediaArticle(
  query: string, 
  browserLanguage?: string, 
  searchCountry?: string
): Promise<{ article: string; language: string }> {
  let priorityLanguage = browserLanguage;
  
  if (!priorityLanguage && searchCountry && COUNTRY_TO_LANGUAGE[searchCountry]) {
    priorityLanguage = COUNTRY_TO_LANGUAGE[searchCountry];
  }

  try {
    if (priorityLanguage) {
      const response = await openai.chat.completions.create({
        model: 'mistralai/ministral-3b',
        temperature: 0.1, 
        max_tokens: 80,
        messages: [
          {
            role: 'system',
            content: `You are a helpful search assistant. The user will provide you with a search query, and you should respond with the best matching Wikipedia article name in ${priorityLanguage} language. Respond in this exact format: ARTICLE_NAME|${priorityLanguage} (without quotes). Try to find the article in ${priorityLanguage} language first. If no suitable article exists in ${priorityLanguage}, fall back to English.`
          },
          {
            role: 'user',
            content: query,
          },
        ],
        stream: false,
      });

      const result = response.choices[0].message.content?.trim() || '';
      
      const parts = result.split('|');
      if (parts.length === 2) {
        const article = parts[0].trim().replace(/^["']|["']$/g, '');
        const language = parts[1].trim().replace(/^["']|["']$/g, '').toLowerCase();
        
        if (article && language) {
          return { article, language };
        }
      }
    }
    
    // Priority 3: AI-based query language detection (fallback)
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
      language: priorityLanguage || 'en'
    };
  } catch (error) {
    console.error('Error suggesting Wikipedia article:', error);
    return {
      article: '',
      language: priorityLanguage || 'en'
    };
  }
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  const startTime = Date.now();
  
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'GET', path: '/api/suggest/wikipedia' });
  wideEvent.setCustom('trace_id', traceId);
  
  const rateLimitResult = await checkRateLimit(req, '/api/suggest/wikipedia');
  if (!rateLimitResult.success) {
    wideEvent.setError({ type: 'RateLimitError', message: 'Rate limit exceeded', code: 'rate_limited' });
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(429);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    return rateLimitResult.response!;
  }

  const query = req.nextUrl.searchParams.get('q');
  const browserLanguage = req.nextUrl.searchParams.get('lang');
  const searchCountry = req.nextUrl.searchParams.get('country');
  
  if (!query) {
    wideEvent.setError({ type: 'ValidationError', message: 'Missing query', code: 'missing_query' });
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(400);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }
  
  wideEvent.setCustom('query_length', query.length);
  wideEvent.setCustom('browser_language', browserLanguage || 'none');
  wideEvent.setCustom('search_country', searchCountry || 'none');

  try {
    const aiStart = Date.now();
    const result = await suggestWikipediaArticle(query, browserLanguage || undefined, searchCountry || undefined);
    const aiLatency = Date.now() - aiStart;
    
    wideEvent.setAI({
      model: 'mistralai/ministral-3b'
    });
    wideEvent.setCustom('ai_latency_ms', aiLatency);
    
    if (!result.article) {
      wideEvent.setError({ type: 'AIError', message: 'No article suggested', code: 'no_article' });
      wideEvent.setCustom('latency_ms', Date.now() - startTime);
      wideEvent.finish(404);
      flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
      return NextResponse.json({ error: 'Could not suggest a Wikipedia article for the provided query.' }, { status: 404 });
    }
    
    wideEvent.setCustom('article_name', result.article);
    wideEvent.setCustom('article_language', result.language);
    wideEvent.setCustom('latency_ms', Date.now() - startTime);
    wideEvent.finish(200);
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
    
    return NextResponse.json({ 
      article: result.article,
      language: result.language 
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('Error in Wikipedia suggestion API:', error);
    wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Internal Server Error', code: 'suggest_error' });
    wideEvent.setCustom('latency_ms', duration);
    wideEvent.finish(500);
    handleAPIError(error, req, '/api/suggest/wikipedia', 'GET', 500);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
