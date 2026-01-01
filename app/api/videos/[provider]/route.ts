import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';

interface VideoAuthor {
  name?: string;
  url?: string;
}

interface VideoMetaUrl {
  scheme?: string;
  netloc?: string;
  hostname?: string;
  favicon?: string;
  path?: string;
}

interface VideoInfo {
  duration?: string;
  creator?: string;
  publisher?: string;
  requires_subscription?: boolean;
  tags?: string[];
  author?: VideoAuthor;
}

interface VideoResult {
  type?: string;
  url?: string;
  title?: string;
  description?: string;
  age?: string;
  page_age?: string;
  video?: VideoInfo;
  meta_url?: VideoMetaUrl;
  thumbnail?: {
    src?: string;
    original?: string;
  };
}

interface SearchResponse {
  results: VideoResult[];
  provider: string;
}

async function getBraveVideos(q: string, count: number = 20): Promise<VideoResult[]> {
  try {
    const params = new URLSearchParams({
      q,
      count: count.toString(),
      country: 'us',
      search_lang: 'en',
      spellcheck: '1'
    });

    const res = await fetch(`https://api.search.brave.com/res/v1/videos/search?${params}`, {
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
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching Brave video search data:', error);
    }
    return [];
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;

  const rateLimitResult = await checkRateLimit(req, '/api/videos');
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  const query = req.nextUrl.searchParams.get('q');
  const countParam = req.nextUrl.searchParams.get('count');
  const count = countParam ? parseInt(countParam, 10) : 20;

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }

  let results: VideoResult[] = [];

  switch (provider.toLowerCase()) {
    case 'brave': {
      results = await getBraveVideos(query, count);

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
