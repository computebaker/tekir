import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { isValidSessionToken, isConvexConfigured, incrementAndCheckRequestCount } from '@/lib/convex-session';

interface Results {
  title: string;
  description: string;
  displayUrl: string;
  url: string;
  source: string;
}

// Helper: remove HTML tags and decode common HTML entities and numeric entities
function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, '');
}

function decodeHTMLEntities(str: string): string {
  if (!str) return '';
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.charAt(0) === '#') {
      const isHex = entity.charAt(1)?.toLowerCase() === 'x';
      const num = isHex ? parseInt(entity.substring(2), 16) : parseInt(entity.substring(1), 10);
      if (!isNaN(num)) return String.fromCodePoint(num);
      return '';
    }
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

async function getBrave(q: string, country: string = 'ALL', safesearch: string = 'moderate') {
  const results: Results[] = [];
  let videos: any[] = [];
  let news: any[] = [];
  try {
    const params = new URLSearchParams({
      q: q,
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
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    (data.web?.results || []).forEach((item: any) => {
      const result: Results = {
        title: sanitizeText(item.title || ''),
        description: sanitizeText(item.description || ''),
        displayUrl: sanitizeText((item.url || '').replace(/^https?:\/\//, '')),
        url: item.url || '',
        source: 'Brave'
      };
      results.push(result);
    });

    // capture videos and news clusters if Brave provides them
    // Brave returns objects like { videos: { results: [...] } } and { news: { results: [...] } }
    if (data.videos && Array.isArray(data.videos.results)) {
      videos = data.videos.results.map((v: any) => ({
        ...v,
        title: sanitizeText(v.title || v.name || ''),
        description: sanitizeText(v.description || ''),
      }));
    }
    if (data.news && Array.isArray(data.news.results)) {
      news = data.news.results.map((n: any) => ({
        ...n,
        title: sanitizeText(n.title || ''),
        description: sanitizeText(n.description || ''),
      }));
    }
  } catch (error) {
    console.error('Error fetching Brave results:', error);
  }
  return { results, videos, news };
}

async function getDuck(q: string): Promise<Results[]> {
  const results: Results[] = [];
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=us-en&p=1&s=0&dc=14&bing_market=US`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!res.ok) throw new Error('Network response was not ok');
    
    const arrayBuffer = await res.arrayBuffer();
    const html = iconv.decode(Buffer.from(arrayBuffer), 'utf-8');
    const $ = load(html);
    
    $('.web-result').each((_, element) => {
      const titleElement = $(element).find('.result__title a');
      const snippetElement = $(element).find('.result__snippet');
      const urlElement = $(element).find('.result__url');
      
  const title = sanitizeText(titleElement.text().trim());
  const description = sanitizeText(snippetElement.text().trim());
      const url = titleElement.attr('href') || '';
      const displayUrl = urlElement.text().trim().replace(/^https?:\/\//, '');
      
      if (title && url) {
        results.push({
          title,
          description,
          displayUrl,
          url,
          source: 'DuckDuckGo'
        });
      }
    });
  } catch (error) {
    console.error('Error fetching DuckDuckGo results:', error);
  }
  return results;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const query = req.nextUrl.searchParams.get('q');
  const country = req.nextUrl.searchParams.get('country') || 'ALL';
  const safesearch = req.nextUrl.searchParams.get('safesearch') || 'moderate';

  if (isConvexConfigured) { // Only check token if Convex is configured
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
      console.warn(`Session token ${sessionToken} exceeded request limit for /api/pars. Count: ${currentCount}`);
      return NextResponse.json({ error: 'Request limit exceeded for this session.' }, { status: 429 });
    }
  } else {
    console.warn("Convex is not configured. Skipping session token validation and request counting for /api/pars. This should be addressed in production.");
  }

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }

  let results: Results[] = [];
  const now = Date.now();

  let videos: any[] = [];
  let news: any[] = [];
  switch (provider.toLowerCase()) {
    case 'duck':
      results = await getDuck(query);
      break;
    case 'brave': {
      const braveRes = await getBrave(query, country, safesearch);
      results = braveRes.results;
      videos = braveRes.videos || [];
      news = braveRes.news || [];
      break;
    }
    default:
      return NextResponse.json({ error: 'Unsupported provider.' }, { status: 400 });
  }

  const responseTime = Date.now() - now;
  
  return NextResponse.json({ 
    results, 
  videos,
  news,
    metadata: { 
      provider: provider.toLowerCase(), 
      query, 
      responseTime: `${responseTime}ms`,
      totalResults: results.length 
    } 
  });
}
