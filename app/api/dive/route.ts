import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
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
    // Set aggressive timeout for faster responses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.statusText}`);
      return ""; // Return empty string on failure
    }
    
    const html = await response.text();
    const $ = load(html);
    
    // Remove unwanted elements for faster processing
    $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar').remove();
    
    // Try to get the most relevant content first
    let mainContent = '';
    
    // Priority order for content extraction
    const selectors = [
      'article',
      '[role="main"]',
      '.content',
      '.post-content', 
      '.entry-content',
      'main',
      '.main-content'
    ];
    
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        mainContent = element.text();
        break;
      }
    }
    
    // Fallback to body if no specific content found
    if (!mainContent) {
      mainContent = $('body').text();
    }
    
    // Clean and optimize content
    mainContent = mainContent
      .replace(/\n{2,}/g, '\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    // Return smaller content for faster processing
    return mainContent.substring(0, 2000); // Reduced from 5000 to 2000
  } catch (error) {
    console.warn(`Error fetching or processing ${url}:`, error);
    return ""; 
  }
}

async function fetchPagesWithFallback(pages: PageContent[]): Promise<PageContent[]> {
  const TARGET_PAGES = 2;
  const MAX_CONCURRENT = 4; // Increase concurrent requests
  
  console.log(`Starting fetch for ${pages.length} candidate pages`);
  
  // Phase 1: Try multiple pages concurrently (not just first 2)
  const firstBatch = pages.slice(0, MAX_CONCURRENT);
  const fetchPromises = firstBatch.map(async (page) => {
    const startTime = Date.now();
    const content = await fetchPageContent(page.url);
    const duration = Date.now() - startTime;
    
    if (content && content.trim().length > 100) { // Minimum content threshold
      console.log(`Successfully fetched: ${page.title} (${duration}ms)`);
      return {
        ...page,
        htmlContent: content,
      };
    } else {
      console.log(`Failed to fetch: ${page.title} (${duration}ms)`);
      return null;
    }
  });
  
  const results = await Promise.all(fetchPromises);
  const validResults = results.filter(result => result !== null) as PageContent[];
  
  // If we have enough pages, return them
  if (validResults.length >= TARGET_PAGES) {
    console.log(`Got ${validResults.length} pages from first batch`);
    return validResults.slice(0, TARGET_PAGES);
  }
  
  // Phase 2: If we need more pages, try remaining ones in parallel
  if (validResults.length < TARGET_PAGES && pages.length > MAX_CONCURRENT) {
    const needed = TARGET_PAGES - validResults.length;
    console.log(`Need ${needed} more pages, trying remaining candidates...`);
    
    const remainingPages = pages.slice(MAX_CONCURRENT);
    const remainingPromises = remainingPages.slice(0, needed * 2).map(async (page) => {
      const startTime = Date.now();
      const content = await fetchPageContent(page.url);
      const duration = Date.now() - startTime;
      
      if (content && content.trim().length > 100) {
        console.log(`Successfully fetched fallback: ${page.title} (${duration}ms)`);
        return {
          ...page,
          htmlContent: content,
        };
      } else {
        console.log(`Failed to fetch fallback: ${page.title} (${duration}ms)`);
        return null;
      }
    });
    
    const remainingResults = await Promise.all(remainingPromises);
    const validRemainingResults = remainingResults.filter(result => result !== null) as PageContent[];
    
    validResults.push(...validRemainingResults.slice(0, needed));
  }
  
  console.log(`Final result: ${validResults.length} pages successfully fetched`);
  return validResults;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  const rateLimitResult = await checkRateLimit(req, '/api/dive');
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
    const { query, pages } = await req.json() as { query: string, pages: PageContent[] };

    if (!query || !pages || pages.length === 0) {
      return NextResponse.json({ error: 'Missing query or pages for Dive mode.' }, { status: 400 });
    }

    console.log(`Dive request: "${query}" with ${pages.length} candidate pages`);

    // Use the new optimized fallback mechanism to fetch pages
    const fetchStartTime = Date.now();
    const validPages = await fetchPagesWithFallback(pages);
    const fetchDuration = Date.now() - fetchStartTime;

    if (validPages.length === 0) {
      return NextResponse.json({ error: 'Could not fetch meaningful content from any of the provided URLs.' }, { status: 500 });
    }

    console.log(`Page fetching completed in ${fetchDuration}ms`);

    // Prepare optimized prompt for LLM
    let contextForLlm = "";
    validPages.forEach((page, index) => {
      // Truncate content for faster processing
      const truncatedContent = page.htmlContent ? page.htmlContent.substring(0, 1000) : '';
      contextForLlm += `Source ${index + 1}: ${truncatedContent}\n\n`;
    });

    const llmPrompt = `Query: "${query}"\n\nContent:\n${contextForLlm}\n\nProvide a concise, accurate answer based on the above sources.`;

    const aiStartTime = Date.now();
    const llmResponse = await openai.chat.completions.create({
      model: 'mistralai/ministral-3b', 
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant for Tekir Dive mode. Provide concise, accurate answers based on web sources. Be direct and helpful. Maximum 80 words.',
        },
        {
          role: 'user',
          content: llmPrompt,
        },
      ],
      max_tokens: 80,
      temperature: 0.3,
    });
    
    const aiDuration = Date.now() - aiStartTime;
    const totalDuration = Date.now() - startTime;

    console.log(`AI processing completed in ${aiDuration}ms`);
    console.log(`Total dive request completed in ${totalDuration}ms`);

    const answer = llmResponse.choices[0].message.content;

    return NextResponse.json({ 
      response: answer || "The AI could not generate a response based on the provided content.", 
      sources: validPages.map(p => ({ url: p.url, title: p.title, description: p.snippet })),
      metadata: {
        totalDuration,
        fetchDuration,
        aiDuration,
        pagesAttempted: pages.length,
        pagesSuccessful: validPages.length
      }
    });

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error(`Error in /api/dive after ${totalDuration}ms:`, error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
