import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, isRedisConfigured, incrementAndCheckRequestCount } from '@/lib/redis';


async function brave(query: string, count: number = 4) {
    const url = `https://api.search.brave.com/res/v1/suggest/search?q=${query}&count=${count}`;
    const headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_AUTOCOMPLETE_KEY || '',
    };

    try {
        const response = await fetch(url, { headers, referrerPolicy: 'no-referrer' });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Error: ${response.status} ${response.statusText || 'unknown error'} - ${errorBody}`);
        }
        const data = await response.json();
        
        // Extract query suggestions and format response as [query, [suggestions]]
        const suggestions = data.results.map((item: { query: string }) => item.query);
        const formattedResponse = [query, suggestions];
        
        return formattedResponse;
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        throw error;
    }
}

async function duck(query: string, count: number = 8) {
    const url = `https://duckduckgo.com/ac/?q=${query}&kl=wt-wt`;
    const headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0"
    };

    try {
        const response = await fetch(url, { headers, referrerPolicy: 'no-referrer' });
        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText || 'unknown error'}`);
        }
        const data = await response.json();
        
        // Extract phrases and format response as [query, [suggestions]]
        const suggestions = data.slice(0, count).map((item: { phrase: string }) => item.phrase);
        const formattedResponse = [query, suggestions];
        
        return formattedResponse;
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        throw error;
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
    const { provider } = await params;
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
    
    const query = req.nextUrl.searchParams.get('q');
    if (!query) {
        return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
    }

    try {
        let answer: any;
        switch (provider.toLowerCase()) {
            case 'brave':
                answer = await brave(query);
                break;
            case 'duck':
                answer = await duck(query);
                break;
            default:
                return NextResponse.json({ error: `Provider '${provider}' is not supported` }, { status: 404 });
        }
        return NextResponse.json(answer);
    } catch (error: any) {
        console.error('Error in Autocomplete API:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}