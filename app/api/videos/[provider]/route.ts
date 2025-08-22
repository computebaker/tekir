import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, incrementAndCheckRequestCount } from '@/lib/convex-session';

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
    console.error('Error fetching Brave video search data:', error);
    return [];
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;

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
      console.warn(`Session token ${sessionToken} exceeded request limit for /api/videos. Count: ${currentCount}`);
      return NextResponse.json({ error: 'Request limit exceeded for this session.' }, { status: 429 });
    }
  } catch (convexError) {
    console.warn("Convex is not configured. Skipping session token validation and request counting for /api/videos. This should be addressed in production.");
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
