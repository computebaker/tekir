import { NextRequest, NextResponse } from 'next/server';

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

interface CacheEntry {
  data: SearchResponse;
  expire: number;
}

const cache: { [key: string]: CacheEntry } = {};
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

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

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const { provider } = params;
  const query = req.nextUrl.searchParams.get('q');
  const countParam = req.nextUrl.searchParams.get('count');
  const count = countParam ? parseInt(countParam, 10) : 20;

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }

  let results: ImageResult[] = [];
  const now = Date.now();

  switch (provider.toLowerCase()) {
    case 'brave': {
      const cacheKey = `brave_images_${query}_${count}`;
      
      // Check cache first
      if (cache[cacheKey] && cache[cacheKey].expire > now) {
        const cachedResponse = cache[cacheKey].data;
        return NextResponse.json(cachedResponse, { status: 200 });
      }
      
      // Fetch fresh data if not in cache or expired
      results = await getBraveImages(query, count);
      
      const response: SearchResponse = {
        results,
        provider: 'Brave'
      };
      
      // Update cache
      cache[cacheKey] = { 
        data: response, 
        expire: now + CACHE_DURATION 
      };
      
      return NextResponse.json(response, { status: 200 });
    }
    default:
        const cacheKey = `brave_images_${query}_${count}`;
      
        // Check cache first
        if (cache[cacheKey] && cache[cacheKey].expire > now) {
          const cachedResponse = cache[cacheKey].data;
          return NextResponse.json(cachedResponse, { status: 200 });
        }
        
        // Fetch fresh data if not in cache or expired
        results = await getBraveImages(query, count);
        
        const response: SearchResponse = {
          results,
          provider: 'Brave'
        };
        
        // Update cache
        cache[cacheKey] = { 
          data: response, 
          expire: now + CACHE_DURATION 
        };
  }
}
