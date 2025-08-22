import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { isValidSessionToken, isConvexConfigured, incrementAndCheckRequestCount } from '@/lib/convex-session';

// Server-side favicon fetch settings
const FAVICON_TIMEOUT_MS = 3000;
const FAVICON_MAX_BYTES = 32 * 1024; // 32KB
const FAVICON_CONCURRENCY = 6;

async function fetchAndEncodeFavicon(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FAVICON_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    if (!res.ok) return undefined;

    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > FAVICON_MAX_BYTES) return undefined;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > FAVICON_MAX_BYTES) return undefined;

    let contentType = res.headers.get('content-type') || '';
    if (!contentType) {
      // Infer from extension when possible
      const lower = url.split('?')[0].toLowerCase();
      if (lower.endsWith('.svg')) contentType = 'image/svg+xml';
      else if (lower.endsWith('.png')) contentType = 'image/png';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (lower.endsWith('.ico')) contentType = 'image/x-icon';
      else contentType = 'application/octet-stream';
    }

    const b64 = buffer.toString('base64');
    return `data:${contentType};base64,${b64}`;
  } catch (err) {
    return undefined;
  }
}

async function fetchFaviconsForResults(items: Array<{ url: string; favicon?: string }>) {
  if (!Array.isArray(items) || items.length === 0) return;

  // Work queue for concurrency
  const queue = items.slice();

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        // Candidate favicon URLs in order: existing favicon value, duckduckgo shortcut, origin/favicon.ico
        const candidates: string[] = [];
        if (item.favicon) candidates.push(item.favicon);
        try {
          const origin = new URL(item.url).origin;
          candidates.push(`https://icons.duckduckgo.com/ip3/${new URL(item.url).hostname}.ico`);
          candidates.push(`${origin}/favicon.ico`);
        } catch (e) {
          // ignore origin parsing errors
        }

        let got: string | undefined = undefined;
        for (const c of candidates) {
          try {
            const encoded = await fetchAndEncodeFavicon(c);
            if (encoded) {
              got = encoded;
              break;
            }
          } catch (e) {
            // try next
          }
        }

        if (got) {
          item.favicon = got;
        } else {
          item.favicon = '';
        }
      } catch (e) {
        // ensure we don't crash the whole processing
        if (item) item.favicon = '';
      }
    }
  };

  // Start workers
  const workers = Array.from({ length: Math.max(1, Math.min(FAVICON_CONCURRENCY, items.length)) }).map(() => worker());
  await Promise.all(workers);
}

interface Results {
  title: string;
  description: string;
  displayUrl: string;
  url: string;
  source: string;
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
  source: 'Brave',
  favicon: sanitizeText(item.meta_url?.favicon || item.profile?.img || '')
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
        let favicon = '';
        try {
          const hostname = new URL(url).hostname;
          // DuckDuckGo public favicon endpoint
          favicon = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
        } catch (e) {
          favicon = '';
        }

        results.push({
          title,
          description,
          displayUrl,
          url,
          source: 'DuckDuckGo',
          favicon
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

  // Attempt to fetch and inline favicons for returned results so the client
  // doesn't need to load remote Brave/Duck domains directly.
  try {
    // Only fetch favicons for a reasonable subset to avoid costly work
    const toFetch = results.slice(0, 20).map(r => ({ url: r.url, favicon: r.favicon }));
    await fetchFaviconsForResults(toFetch as any);
    // copy back encoded favicons into results
    for (let i = 0; i < toFetch.length; i++) {
      if (toFetch[i].favicon) {
        results[i].favicon = toFetch[i].favicon;
      }
    }
  } catch (e) {
    // ignore favicon fetch failures — results still returned without favicons
    console.warn('Favicon fetching failed:', e);
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
