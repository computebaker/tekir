import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { isValidSessionToken, isRedisConfigured, incrementAndCheckRequestCount } from '@/lib/redis';

interface Results {
  title: string;
  description: string;
  displayUrl: string;
  url: string;
  source: string;
}

interface CacheEntry {
  data: Results[];
  expire: number;
}

const cache: { [key: string]: CacheEntry } = {};

async function getBrave(q: string): Promise<Results[]> {
  const results: Results[] = [];
  try {
    const res = await fetch('https://api.search.brave.com/res/v1/web/search?q=' + q, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_KEY || ''
      }
    });
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    data.web.results.forEach((item: any) => {
      const result: Results = {
        title: item.title || '',
        description: (item.description || '').replace(/<[^>]+>/g, ''),
        displayUrl: (item.url || '').replace(/^https?:\/\//, ''),
        url: item.url || '',
        source: 'Brave'
      };
      results.push(result);
    });
  } catch (error) {
    console.error('Error fetching Brave search data:', error);
  }
  return results;
}

async function getDuck(q: string): Promise<Results[]> {
  const results: Results[] = [];
  try {
    const res = await fetch('https://html.duckduckgo.com/html?q=' + q, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
      }
    });
    const buffer = await res.arrayBuffer();
    const html = Buffer.from(buffer).toString();
    const $ = load(html);
    if ($('.result--no-result').length > 0) {
      return results;
    }
    $('.results_links_deep').each((_, productHTMLElement) => {
      const title: string = $(productHTMLElement)
        .find('.result__title a')
        .text() as string;
      let displayUrl: string = $(productHTMLElement)
        .find('.result__url')
        .text() as string;
      const desc: string = $(productHTMLElement)
        .find('.result__snippet')
        .text()
        .trim() as string;

      displayUrl = displayUrl.replace(/\s/g, '');
      const urlnospace = displayUrl.replace(/ /g, '');
      let url = urlnospace.replace(/\u203a/g, '/');

      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      if (url.includes('...') || displayUrl.includes('...')) {
        url = url.substring(0, url.indexOf('...'));
        displayUrl = displayUrl.substring(0, displayUrl.indexOf('...'));
      }
      if (url.endsWith('/')) {
        url = url.slice(0, -1);
      }
      const description = desc.replace(/<[^>]+>/g, '').replace(/(\r\n|\n|\r)/gm, '');
      if (title === '' || displayUrl === '' || url === '') {
        return;
      }
      const result: Results = {
        title: title,
        description: description,
        displayUrl: displayUrl,
        url: url,
        source: 'DuckDuckGo'
      };
      results.push(result);
    });
  } catch (error) {
    console.error('Error fetching data:', error);
  }
  return results;
}

async function getGoogle(q: string, n: number): Promise<Results[]> {
  const results: Results[] = [];
  const res = await fetch("https://www.google.com/search?q=" + q + "&start=" + n);
  const buffer = await res.arrayBuffer();
  const html = iconv.decode(Buffer.from(buffer), 'ISO-8859-1');
  const $ = load(html);
  $("div.Gx5Zad.xpd.EtOod.pkphOe").each((div, productHTMLElement) => {
    const title: string = $(productHTMLElement).find("div.BNeawe.vvjwJb.AP7Wnd").text() as string;
    const displayUrl: string = $(productHTMLElement).find("div.BNeawe.UPmit.AP7Wnd.lRVwie").text() as string;
    const trackerurl: string = $(productHTMLElement).find("div.egMi0.kCrYT a").attr("href") as string;
    const description: string = $(productHTMLElement).find("div.BNeawe.s3v9rd.AP7Wnd").text() as string;

    const prefix = '/url?q=';
    const suffix = '&sa=';
    let url: string = '';
    if (trackerurl) {
      if (trackerurl.startsWith(prefix)) {
        const startIndex = prefix.length;
        const endIndex = trackerurl.indexOf(suffix);
        if (endIndex !== -1) {
          url = trackerurl.substring(startIndex, endIndex);
        } else {
          url = trackerurl.substring(startIndex);
        }
      } else {
        url = trackerurl;
      }
    } else {
      return;
    }
    const result: Results = {
      title: title,
      description: description,
      displayUrl: displayUrl,
      url: url,
      source: "Google"
    };
    results.push(result);
  });
  return results;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const query = req.nextUrl.searchParams.get('q');

  if (isRedisConfigured) { // Only check token if Redis is configured
    const sessionToken = req.cookies.get('session-token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session token.' }, { status: 401 });
    }

    const isValid = await isValidSessionToken(sessionToken);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired session token.' }, { status: 403 });
    }

    // Check request count limit
    const { allowed, currentCount } = await incrementAndCheckRequestCount(sessionToken);
    if (!allowed) {
      console.warn(`Session token ${sessionToken} exceeded request limit for /api/pars. Count: ${currentCount}`);
      return NextResponse.json({ error: 'Request limit exceeded for this session.' }, { status: 429 }); // 429 Too Many Requests
    }
  } else {
    // Optionally, log a warning if Redis is not configured but you expect it to be
    console.warn("Redis is not configured. Skipping session token validation and request counting for /api/pars. This should be addressed in production.");
  }

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
  }

  let results: Results[] = [];
  const now = Date.now();

  switch (provider.toLowerCase()) {
    case 'duck': {
      const cacheKey = `duck_${query}`;
      if (cache[cacheKey] && cache[cacheKey].expire > now) {
        results = cache[cacheKey].data;
      } else {
        results = await getDuck(query);
        cache[cacheKey] = { data: results, expire: now + 30 * 60 * 1000 };
      }
      break;
    }
    case 'brave': {
      const cacheKey = `brave_${query}`;
      if (cache[cacheKey] && cache[cacheKey].expire > now) {
        results = cache[cacheKey].data;
      } else {
        results = await getBrave(query);
        cache[cacheKey] = { data: results, expire: now + 30 * 60 * 1000 };
      }
      break;
    }
    case 'google': {
      const cacheKey = `google_${query}`;
      if (cache[cacheKey] && cache[cacheKey].expire > now) {
        results = cache[cacheKey].data;
      } else {
        results = await getGoogle(query, 0);
        cache[cacheKey] = { data: results, expire: now + 30 * 60 * 1000 };
      }
      break;
    }
    default:
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  }
  return NextResponse.json(results, { status: 200 });
}