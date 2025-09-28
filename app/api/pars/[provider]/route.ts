import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';
import { getJWTUser } from '@/lib/jwt-auth';

async function fetchFaviconsForResults(items: Array<{ url: string; favicon?: string }>) {
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    if (!item.favicon) {
      try {
        const hostname = new URL(item.url).hostname;
        // Use our favicon proxy instead of direct DuckDuckGo requests
        item.favicon = `/api/favicon/${hostname}`;
      } catch (e) {
        // If URL parsing fails, skip favicon
        item.favicon = '';
      }
    }
  }
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

function mapSafeSearchToGoogle(value: string | null | undefined): 'active' | undefined {
  if (!value) return 'active';
  const normalized = value.toLowerCase();
  if (normalized === 'off') return undefined;
  return 'active';
}

function normalizeGoogleCountry(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.toUpperCase() === 'ALL') return undefined;
  const code = trimmed.slice(0, 2).toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : undefined;
}

function normalizeGoogleLang(value: string | null | undefined): { hl?: string; lr?: string } {
  if (!value) return {};
  const normalized = value.toLowerCase();
  return {
    hl: normalized,
    lr: `lang_${normalized}`,
  };
}

async function getGoogle(q: string, country?: string, safesearch?: string, lang?: string) {
  const results: Results[] = [];
  let totalResults = 0;
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  if (!apiKey || !cx) {
    console.error('Google Custom Search credentials are missing. Set GOOGLE_API_KEY and GOOGLE_CX.');
    return { results, totalResults };
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx,
      q,
      num: '10',
    });

    const safeSearchParam = mapSafeSearchToGoogle(safesearch);
    if (safeSearchParam) {
      params.set('safe', safeSearchParam);
    }

    const normalizedCountry = normalizeGoogleCountry(country);
    if (normalizedCountry) {
      params.set('gl', normalizedCountry);
    }

    const langParams = normalizeGoogleLang(lang);
    if (langParams.hl) params.set('hl', langParams.hl);
    if (langParams.lr) params.set('lr', langParams.lr);

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorPayload = await response.text().catch(() => '');
      throw new Error(`Google Custom Search error: ${response.status} ${response.statusText} ${errorPayload}`.trim());
    }

    const data = await response.json();
    totalResults = Number(data?.searchInformation?.totalResults ?? 0) || 0;

    (data?.items || []).forEach((item: any) => {
      const link = item?.link || '';
      if (!link) return;

      let favicon = '';
      try {
        favicon = `/api/favicon/${new URL(link).hostname}`;
      } catch {
        favicon = '';
      }

      results.push({
        title: sanitizeText(item?.title || ''),
        description: sanitizeText(item?.snippet || ''),
        displayUrl: sanitizeText(item?.displayLink || link.replace(/^https?:\/\//, '')),
        url: link,
        source: 'Google',
        favicon,
      });
    });
  } catch (error) {
    console.error('Error fetching Google results:', error);
  }

  return { results, totalResults };
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
        // Don't extract favicon from Brave - let DuckDuckGo handle all favicons
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
          // Use our favicon proxy instead of direct DuckDuckGo requests
          favicon = `/api/favicon/${hostname}`;
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
  const lang = req.nextUrl.searchParams.get('lang') || req.nextUrl.searchParams.get('language') || undefined;

  const rateLimitResult = await checkRateLimit(req, '/api/pars');
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }

  let results: Results[] = [];
  const now = Date.now();

  let videos: any[] = [];
  let news: any[] = [];
  let totalResultsCount = 0;
  switch (provider.toLowerCase()) {
    case 'duck':
      results = await getDuck(query);
      totalResultsCount = results.length;
      break;
    case 'brave': {
      const braveRes = await getBrave(query, country, safesearch);
      results = braveRes.results;
      videos = braveRes.videos || [];
      news = braveRes.news || [];
      totalResultsCount = results.length;
      break;
    }
    case 'google': {
      const authUser = await getJWTUser(req);
      if (!authUser) {
        return NextResponse.json({ error: 'Authentication required for Google search.' }, { status: 401 });
      }
      const googleRes = await getGoogle(query, country, safesearch, lang);
      results = googleRes.results;
      totalResultsCount = googleRes.totalResults || results.length;
      break;
    }
    default:
      return NextResponse.json({ error: 'Unsupported provider.' }, { status: 400 });
  }

  // Generate favicon URLs for returned results using our favicon proxy
  try {
    await fetchFaviconsForResults(results);
  } catch (e) {
    console.warn('Favicon processing failed:', e);
  }

  const responseTime = Date.now() - now;
  // Fire-and-forget usage logging (no PII, aggregated daily)
  try {
    const convex = getConvexClient();
    const type = 'web'; // this route serves web; videos/news are included in payload
    await convex.mutation(api.usage.logSearchUsage, {
      provider: provider.toLowerCase(),
      type,
      responseTimeMs: responseTime,
      totalResults: totalResultsCount || results.length,
      queryText: query || undefined,
    });
  } catch (e) {
    console.warn('Failed to log search usage:', e);
  }
  
  return NextResponse.json({
    results,
    videos,
    news,
    metadata: {
      provider: provider.toLowerCase(),
      query,
      responseTime: `${responseTime}ms`,
      totalResults: totalResultsCount || results.length,
    },
  });
}
