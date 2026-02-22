import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import { WideEvent } from '@/lib/wide-event';
import { flushServerEvents } from '@/lib/analytics-server';
import { handleAPIError } from '@/lib/api-error-tracking';
import { randomUUID } from 'crypto';

async function brave(query: string, count: number = 4, country?: string, lang?: string, safesearch?: string) {
    const params = new URLSearchParams({ q: query, count: String(count) });
    if (country) params.set('country', country);
    if (lang) params.set('lang', lang);
    if (safesearch) params.set('safesearch', safesearch);
    const url = `https://api.search.brave.com/res/v1/suggest/search?${params.toString()}`;
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

async function duck(query: string, count: number = 8, country?: string, lang?: string, safesearch?: string) {
        // Map country/lang to DuckDuckGo 'kl' parameter when possible. Default to wt-wt
        let kl = 'wt-wt';
        try {
            if (country && lang) {
                // Example mapping: 'us' + 'en' -> 'us-en'
                kl = `${country.toLowerCase()}-${lang.toLowerCase()}`;
            } else if (country) {
                kl = country.toLowerCase();
            } else if (lang) {
                kl = `${lang.toLowerCase()}-${lang.toLowerCase()}`;
            }
        } catch (e) {
            kl = 'wt-wt';
        }
        const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&kl=${encodeURIComponent(kl)}`;
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
    
    const traceId = randomUUID();
    const startTime = Date.now();
    
    const wideEvent = WideEvent.getOrCreate();
    wideEvent.setRequest({ method: 'GET', path: `/api/autocomplete/${provider}` });
    wideEvent.setCustom('trace_id', traceId);
    wideEvent.setCustom('provider', provider);
    
    const rateLimitResult = await checkRateLimit(req, '/api/autocomplete');
    if (!rateLimitResult.success) {
        wideEvent.setError({ type: 'RateLimitError', message: 'Rate limit exceeded', code: 'rate_limited' });
        wideEvent.setCustom('latency_ms', Date.now() - startTime);
        wideEvent.finish(429);
        flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
        return rateLimitResult.response!;
    }
    
    const query = req.nextUrl.searchParams.get('q');
    const country = req.nextUrl.searchParams.get('country') || undefined;
    const safesearch = req.nextUrl.searchParams.get('safesearch') || undefined;
    const lang = req.nextUrl.searchParams.get('lang') || req.nextUrl.searchParams.get('language') || undefined;
    if (!query) {
        wideEvent.setError({ type: 'ValidationError', message: 'Missing query', code: 'missing_query' });
        wideEvent.setCustom('latency_ms', Date.now() - startTime);
        wideEvent.finish(400);
        flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
        return NextResponse.json({ error: 'Missing query parameter "q".' }, { status: 400 });
    }
    
    wideEvent.setCustom('query_length', query.length);
    wideEvent.setCustom('country', country || 'none');
    wideEvent.setCustom('lang', lang || 'none');

    try {
        let answer: any;
        switch (provider.toLowerCase()) {
            case 'brave':
                answer = await brave(query, 4, country, lang, safesearch);
                break;
            case 'duck':
                answer = await duck(query, 8, country, lang, safesearch);
                break;
            default:
                wideEvent.setError({ type: 'ValidationError', message: 'Unsupported provider', code: 'unsupported_provider' });
                wideEvent.setCustom('latency_ms', Date.now() - startTime);
                wideEvent.finish(404);
                flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
                return NextResponse.json({ error: `Provider '${provider}' is not supported` }, { status: 404 });
        }
        
        wideEvent.setCustom('suggestions_count', Array.isArray(answer[1]) ? answer[1].length : 0);
        wideEvent.setCustom('latency_ms', Date.now() - startTime);
        wideEvent.finish(200);
        flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));
        
        return NextResponse.json(answer);
    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error('Error in Autocomplete API:', error);
        wideEvent.setError({ type: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message : 'Internal Server Error', code: 'autocomplete_error' });
        wideEvent.setCustom('latency_ms', duration);
        wideEvent.finish(500);
        handleAPIError(error, req, `/api/autocomplete/${provider}`, 'GET', 500);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
