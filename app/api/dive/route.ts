import { NextRequest, NextResponse } from 'next/server';
import { isValidSessionToken, isRedisConfigured, incrementAndCheckRequestCount } from '@/lib/redis';
import { load } from 'cheerio';
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tekir.co',
    'X-Title': 'Tekir', 
  },
});

interface PageContent {
  url: string;
  title: string;
  snippet?: string; // Optional: a small piece of text from the page
  htmlContent?: string; // Full HTML content fetched by this backend
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'TekirDiveBot/1.0' } });
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.statusText}`);
      return ""; // Return empty string on failure
    }
    const html = await response.text();
    const $ = load(html);
    let mainContent = $('main').text() || $('article').text() || $('body').text();
    mainContent = mainContent.replace(/\n{2,}/g, '\n').replace(/\s{2,}/g, ' ').trim();
    return mainContent.substring(0, 5000); 
  } catch (error) {
    console.warn(`Error fetching or processing ${url}:`, error);
    return ""; 
  }
}

async function fetchPagesWithFallback(pages: PageContent[]): Promise<PageContent[]> {
  const results: PageContent[] = [];
  
  const initialPages = pages.slice(0, 2);
  const initialPromises = initialPages.map(async (page) => {
    const content = await fetchPageContent(page.url);
    return {
      ...page,
      htmlContent: content,
    };
  });
  
  const initialResults = await Promise.all(initialPromises);
  const validInitialResults = initialResults.filter(page => page.htmlContent && page.htmlContent.trim().length > 0);
  
  // If we got 2 valid pages from the initial fetch, we're done
  if (validInitialResults.length >= 2) {
    return validInitialResults.slice(0, 2);
  }
  
  results.push(...validInitialResults);
  
  // Calculate how many more pages we need to reach 2 total
  const needed = 2 - validInitialResults.length;
  
  if (needed > 0 && pages.length > 2) {
    console.log(`Only ${validInitialResults.length} of first 2 pages fetched successfully. Trying fallback pages...`);
    
    const remainingPages = pages.slice(2);
    
    for (const page of remainingPages) {
      if (results.length >= 2) break;
      
      const content = await fetchPageContent(page.url);
      if (content && content.trim().length > 0) {
        results.push({
          ...page,
          htmlContent: content,
        });
        console.log(`Successfully fetched fallback page: ${page.url}`);
      }
    }
  }
  
  return results;
}

export async function POST(req: NextRequest) {
  if (isRedisConfigured) { // Only check token if Redis is configured
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
      console.warn(`Session token ${sessionToken} exceeded request limit for /api/dive. Count: ${currentCount}`);
      return NextResponse.json({ error: 'Request limit exceeded for this session.' }, { status: 429 });
    }
  } else {
    console.warn("Redis is not configured. Skipping session token validation and request counting for /api/dive. This should be addressed in production.");
  }

  try {
    const { query, pages } = await req.json() as { query: string, pages: PageContent[] };

    if (!query || !pages || pages.length === 0) {
      return NextResponse.json({ error: 'Missing query or pages for Dive mode.' }, { status: 400 });
    }

    // Use the new fallback mechanism to fetch pages
    const validPages = await fetchPagesWithFallback(pages);

    if (validPages.length === 0) {
      return NextResponse.json({ error: 'Could not fetch meaningful content from any of the provided URLs.' }, { status: 500 });
    }

    console.log(`Dive mode: Successfully fetched ${validPages.length} pages out of ${pages.length} candidate pages`);

    // Prepare prompt for LLM
    let contextForLlm = "";
    validPages.forEach((page, index) => {
      contextForLlm += `Source ${index + 1} (URL: ${page.url}):\n${page.htmlContent}\n\n`;
    });

    const llmPrompt = `The user is asking: "${query}". 

Based on the following content from up to 2 web pages, provide a comprehensive answer. Synthesize the information and present it clearly. Do not just summarize each source. If the sources contradict, point it out. If the sources don't provide enough information, say so. Be objective and informative. Here is the content:

${contextForLlm}Respond directly to the user's query: "${query}".`;

    const llmResponse = await openai.chat.completions.create({
      model: 'mistralai/mistral-small-3.2-24b-instruct:free', 
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant for Tekir Dive mode. You will be given a user query and content from several web pages. Your task is to synthesize this information to provide a comprehensive answer to the user query. Cite the sources used by referring to their URL when relevant. If information is conflicting or insufficient, state that clearly. Do not use markdown in your answers. Keep your responses concise and focused on the user query. Keep it short and to the point. Maximum 90 tokens.',
        },
        {
          role: 'user',
          content: llmPrompt,
        },
      ],
      max_tokens: 100,
      temperature: 0.5,
    });

    const answer = llmResponse.choices[0].message.content;

    return NextResponse.json({ 
      response: answer || "The AI could not generate a response based on the provided content.", 
      sources: validPages.map(p => ({ url: p.url, title: p.title, description: p.snippet })) // Return original page info as sources
    });

  } catch (error: any) {
    console.error("Error in /api/dive:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
