import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';

interface ImageResult {
  title: string;
  url: string;
  source: string;
  thumbnail: {
    src: string;
  };
  properties: {
    url: string;
    placeholder: string;
  };
  meta_url: {
    netloc: string;
    path: string;
  };
}

interface SearchResponse {
  results: ImageResult[];
  provider: string;
}

async function getBraveImages(q: string, count: number = 20): Promise<ImageResult[]> {
  try {
    const params = new URLSearchParams({
      q,
      safesearch: 'strict',
      count: count.toString(),
      search_lang: 'en',
      country: 'us',
      spellcheck: '1'
    });

    const res = await fetch(`https://api.search.brave.com/res/v1/images/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_KEY || ''
      }
    });

    if (!res.ok) {
      throw new Error(`Brave API responded with status: ${res.status}`);
    }

    const data = await res.json();
    return data.results || [];
  } catch (error) {
    console.error('Error fetching Brave image search data:', error);
    return [];
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;

  const rateLimitResult = await checkRateLimit(req, '/api/images');
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  const query = req.nextUrl.searchParams.get('q');
  const countParam = req.nextUrl.searchParams.get('count');
  const count = countParam ? parseInt(countParam, 10) : 20;

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }

  let results: ImageResult[] = [];

  switch (provider.toLowerCase()) {
    case 'brave': {
        results = await getBraveImages(query, count);
        
        const response: SearchResponse = {
          results,
          provider: 'Brave'
        };
        
        return NextResponse.json(response, { status: 200 });
      }
      case 'duck': {
        /* Fix after DuckDuckGo API is available */
        
        results = await getBraveImages(query, count);
        
        const response: SearchResponse = {
          results,
          provider: 'Brave'
        };
        
        return NextResponse.json(response, { status: 200 });
      }
    default:
      return NextResponse.json({ error: 'Invalid or unsupported provider. Currently only "brave" is supported.' }, { status: 400 });
  }
}
