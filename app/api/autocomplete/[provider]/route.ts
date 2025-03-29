import { NextRequest, NextResponse } from 'next/server';

const cache: { [key: string]: any } = {};

async function brave(query: string, count: number = 4) {
    const key = `brave-${query}`;
    if (cache[key]) return cache[key];

    // If not cached, fetch from the API.
    const url = `https://api.search.brave.com/res/v1/suggest/search?q=${query}&count=${count}`;
    const headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": process.env.BRAVE_API_KEY || '',
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        
        // Extract query suggestions and format response as [query, [suggestions]]
        const suggestions = data.results.map((item: { query: string }) => item.query);
        const formattedResponse = [query, suggestions];
        
        // Cache the result with the key.
        cache[key] = formattedResponse;
        return formattedResponse;
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        throw error;
    }
}

async function duck(query: string, count: number = 8) {
    const key = `duck-${query}`;
    if (cache[key]) return cache[key];

    // If not cached, fetch from the API
    const url = `https://duckduckgo.com/ac/?q=${query}&kl=wt-wt`;
    const headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:135.0) Gecko/20100101 Firefox/135.0"
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        
        // Extract phrases and format response as [query, [suggestions]]
        const suggestions = data.slice(0, count).map((item: { phrase: string }) => item.phrase);
        const formattedResponse = [query, suggestions];
        
        // Cache the result
        cache[key] = formattedResponse;
        return formattedResponse;
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        throw error;
    }
}

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
    const { provider } = params;
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
        return NextResponse.json({ answer });
    } catch (error: any) {
        console.error('Error in Autocomplete API:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}