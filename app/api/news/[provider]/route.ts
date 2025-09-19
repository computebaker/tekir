import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';

interface NewsResult {
  title: string;
  description: string;
  url: string;
  source: string;
  age: string;
  thumbnail?: string;
  favicon?: string;
}

// Helper: remove HTML tags and decode common HTML entities and numeric entities
function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, '');
}

function decodeHTMLEntities(str: string): string {
  if (!str) return '';
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.charAt(0) === '#') {
      // numeric entity
      const isHex = entity.charAt(1)?.toLowerCase() === 'x';
      const num = isHex ? parseInt(entity.substring(2), 16) : parseInt(entity.substring(1), 10);
      if (!isNaN(num)) return String.fromCodePoint(num);
      return '';
    }
    // named entities (common subset)
    switch (entity) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      case 'nbsp': return ' ';
      default: return '';
    }
  });
}

function sanitizeText(value: any): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  return decodeHTMLEntities(stripTags(s)).trim();
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
          title: sanitizeText(item.title || ''),
          description: sanitizeText(item.description || ''),
          url: item.url || '',
          source: sanitizeText(item.meta_url?.hostname || (item.url ? new URL(item.url).hostname : '')),
          age: item.age || 'Recently',
          thumbnail: item.thumbnail?.src || undefined
          // Don't extract favicon from Brave - let DuckDuckGo handle all favicons
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

  const rateLimitResult = await checkRateLimit(req, '/api/news');
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
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
