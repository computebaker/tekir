import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, incrementAndCheckRequestCount } from '@/lib/convex-session';

interface NewsResult {
  title: string;
  description: string;
  url: string;
  source: string;
  age: string;
  thumbnail?: string;
  favicon?: string;
}

async function getBraveNews(q: string, country: string = 'ALL', safesearch: string = 'moderate'): Promise<NewsResult[]> {
  const results: NewsResult[] = [];
  try {
    // Add "news" to the query to get news-related results
    const newsQuery = `${q} news`;
    
    const params = new URLSearchParams({
      q: newsQuery,
      country: country,
      safesearch: safesearch,
      spellcheck: 'false',
      text_decorations: 'false'
    });

    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_KEY || ''
      }
    });
    
    if (!res.ok) {
      console.error('Brave API response:', res.status, res.statusText);
      throw new Error(`Network response was not ok: ${res.status}`);
    }
    const data = await res.json();
    
    if (data.web && data.web.results && Array.isArray(data.web.results)) {
      // Filter results to prefer news sources and recent content
      const newsResults = data.web.results.filter((item: any) => {
        const url = item.url || '';
        const title = item.title || '';
        const description = item.description || '';
        
        // Check if the result is from a news source or contains news-related content
        const newsKeywords = ['news', 'breaking', 'latest', 'today', 'yesterday', 'report', 'update'];
        const newsDomains = ['cnn.com', 'bbc.com', 'reuters.com', 'ap.org', 'bloomberg.com', 'wsj.com', 'nytimes.com', 'guardian.com', 'foxnews.com', 'nbcnews.com', 'abcnews.com', 'cbsnews.com'];
        
        const isNewsSource = newsDomains.some(domain => url.includes(domain));
        const hasNewsKeywords = newsKeywords.some(keyword => 
          title.toLowerCase().includes(keyword) || description.toLowerCase().includes(keyword)
        );
        
        return isNewsSource || hasNewsKeywords;
      });
      
      newsResults.forEach((item: any) => {
        const result: NewsResult = {
          title: item.title || '',
          description: (item.description || '').replace(/<[^>]+>/g, ''),
          url: item.url || '',
          source: item.meta_url?.hostname || new URL(item.url || '').hostname || '',
          age: item.age || 'Recently',
          thumbnail: item.thumbnail?.src || undefined,
          favicon: item.meta_url?.favicon || undefined
        };
        results.push(result);
      });
    }
  } catch (error) {
    console.error('Error fetching Brave news data:', error);
  }
  return results;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const query = req.nextUrl.searchParams.get('q');
  const country = req.nextUrl.searchParams.get('country') || 'ALL';
  const safesearch = req.nextUrl.searchParams.get('safesearch') || 'moderate';

  // Check session token with Convex
  const sessionToken = req.cookies.get('session-token')?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Missing session token.' }, { status: 401 });
  }

  try {
    const isValid = await isValidSessionToken(sessionToken);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired session token.' }, { status: 403 });
    }

    const { allowed, currentCount } = await incrementAndCheckRequestCount(sessionToken);
    if (!allowed) {
      console.warn(`Session token ${sessionToken} exceeded request limit for /api/news. Count: ${currentCount}`);
      return NextResponse.json({ error: 'Request limit exceeded for this session.' }, { status: 429 });
    }
  } catch (convexError) {
    console.warn("Convex is not configured. Skipping session token validation and request counting for /api/news. This should be addressed in production.");
  }

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }

  let results: NewsResult[] = [];

  switch (provider.toLowerCase()) {
    case 'brave':
      results = await getBraveNews(query, country, safesearch);
      break;
    default:
      return NextResponse.json({ error: 'Invalid news provider' }, { status: 400 });
  }

  return NextResponse.json({ results }, { status: 200 });
}
