import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import { getJWTUser } from '@/lib/jwt-auth';

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

async function getGoogleImages(
  q: string,
  count: number,
  country?: string,
  safesearch?: string,
  lang?: string
): Promise<ImageResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  if (!apiKey || !cx) {
    console.error('Google Custom Search credentials are missing. Set GOOGLE_API_KEY and GOOGLE_CX.');
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx,
      q,
      num: Math.min(Math.max(count, 1), 10).toString(),
      searchType: 'image',
    });

    const safeSearchParam = mapSafeSearchToGoogle(safesearch);
    if (safeSearchParam) params.set('safe', safeSearchParam);

    const normalizedCountry = normalizeGoogleCountry(country);
    if (normalizedCountry) params.set('gl', normalizedCountry);

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
      throw new Error(`Google Custom Search image error: ${response.status} ${response.statusText} ${errorPayload}`.trim());
    }

    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    return items.map((item: any) => {
      const link = typeof item?.link === 'string' ? item.link : '';
      const title = typeof item?.title === 'string' ? item.title : '';
      const imageInfo = item?.image || {};
      const thumbnailLink = typeof imageInfo?.thumbnailLink === 'string' ? imageInfo.thumbnailLink : link;
      const contextLink = typeof imageInfo?.contextLink === 'string' ? imageInfo.contextLink : link;

      let netloc = '';
      let path = '';
      try {
        const url = new URL(contextLink || link);
        netloc = url.hostname;
        path = url.pathname;
      } catch {
        // ignore parsing errors
      }

      return {
        title,
        url: link,
        source: item?.displayLink || netloc || '',
        thumbnail: {
          src: thumbnailLink || link,
        },
        properties: {
          url: contextLink || link,
          placeholder: thumbnailLink || link,
        },
        meta_url: {
          netloc,
          path,
        },
      } satisfies ImageResult;
    });
  } catch (error) {
    console.error('Error fetching Google image results:', error);
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
  const country = req.nextUrl.searchParams.get('country') || 'ALL';
  const safesearch = req.nextUrl.searchParams.get('safesearch') || 'moderate';
  const lang = req.nextUrl.searchParams.get('lang') || req.nextUrl.searchParams.get('language') || undefined;
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
      case 'google': {
        const authUser = await getJWTUser(req);
        if (!authUser) {
          return NextResponse.json({ error: 'Authentication required for Google image search.' }, { status: 401 });
        }
        const results = await getGoogleImages(query, count, country, safesearch, lang);

        const response: SearchResponse = {
          results,
          provider: 'Google',
        };

        return NextResponse.json(response, { status: 200 });
      }
    default:
      return NextResponse.json({ error: 'Invalid or unsupported provider. Supported providers are "brave", "google", and "duck".' }, { status: 400 });
  }
}
