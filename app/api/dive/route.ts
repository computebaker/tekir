import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import { load } from 'cheerio';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import {
  trackServerAIError,
  flushServerEvents,
  trackLLMGeneration,
} from '@/lib/analytics-server';
import { WideEvent } from '@/lib/wide-event';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tekir.co',
    'X-Title': 'Tekir',
  },
});

const DIVE_MODEL = 'openai/gpt-5-mini';
const DIVE_PROVIDER = 'openai';

interface PageContent {
  url: string;
  title: string;
  snippet?: string;
  htmlContent?: string;
}

async function fetchPageContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    const $ = load(html);

    $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar').remove();

    let mainContent = '';

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

    if (!mainContent) {
      mainContent = $('body').text();
    }

    mainContent = mainContent
      .replace(/\n{2,}/g, '\n')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return mainContent.substring(0, 2000);
  } catch (error) {
    return "";
  }
}

async function fetchPagesWithFallback(pages: PageContent[]): Promise<PageContent[]> {
  const TARGET_PAGES = 2;
  const MAX_CONCURRENT = 4;

  const firstBatch = pages.slice(0, MAX_CONCURRENT);
  const fetchPromises = firstBatch.map(async (page) => {
    const content = await fetchPageContent(page.url);

    if (content && content.trim().length > 100) {
      return {
        ...page,
        htmlContent: content,
      };
    } else {
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);
  const validResults = results.filter(result => result !== null) as PageContent[];

  if (validResults.length >= TARGET_PAGES) {
    return validResults.slice(0, TARGET_PAGES);
  }

  if (validResults.length < TARGET_PAGES && pages.length > MAX_CONCURRENT) {
    const needed = TARGET_PAGES - validResults.length;
    const remainingPages = pages.slice(MAX_CONCURRENT);
    const remainingPromises = remainingPages.slice(0, needed * 2).map(async (page) => {
      const content = await fetchPageContent(page.url);

      if (content && content.trim().length > 100) {
        return {
          ...page,
          htmlContent: content,
        };
      } else {
        return null;
      }
    });

    const remainingResults = await Promise.all(remainingPromises);
    const validRemainingResults = remainingResults.filter(result => result !== null) as PageContent[];

    validResults.push(...validRemainingResults.slice(0, needed));
  }

  return validResults;
}

export async function POST(req: NextRequest) {
  // Generate unique trace ID for this request
  const traceId = randomUUID();
  const startTime = Date.now();

  // Initialize wide event
  const wideEvent = WideEvent.getOrCreate();
  wideEvent.setRequest({ method: 'POST', path: '/api/dive' });
  wideEvent.setCustom('trace_id', traceId);

  const rateLimitResult = await checkRateLimit(req, '/api/dive');
  if (!rateLimitResult.success) {
    wideEvent.setError({ type: 'RateLimitError', message: 'Rate limit exceeded', code: 'rate_limited' });
    wideEvent.finish(429);
    return rateLimitResult.response!;
  }

  try {
    const { query, pages } = await req.json() as { query: string, pages: PageContent[] };

    if (!query || !pages || pages.length === 0) {
      wideEvent.setError({ type: 'ValidationError', message: 'Missing query or pages', code: 'invalid_input' });
      wideEvent.finish(400);
      return NextResponse.json({ error: 'Missing query or pages for Dive mode.' }, { status: 400 });
    }

    wideEvent.setCustom('query_length', query.length);
    wideEvent.setCustom('candidate_pages', pages.length);

    // Fetch pages
    const fetchStartTime = Date.now();
    const validPages = await fetchPagesWithFallback(pages);
    const fetchDuration = Date.now() - fetchStartTime;

    if (validPages.length === 0) {
      wideEvent.setError({ type: 'FetchError', message: 'Could not fetch any pages', code: 'fetch_failed' });
      wideEvent.finish(500);
      return NextResponse.json({ error: 'Could not fetch meaningful content from any of the provided URLs.' }, { status: 500 });
    }

    wideEvent.setCustom('pages_fetched', validPages.length);
    wideEvent.setCustom('fetch_duration_ms', fetchDuration);

    // Prepare prompt for LLM
    let contextForLlm = "";
    validPages.forEach((page, index) => {
      const truncatedContent = page.htmlContent ? page.htmlContent.substring(0, 1000) : '';
      contextForLlm += `Source ${index + 1}: ${truncatedContent}\n\n`;
    });

    const llmPrompt = `Query: "${query}"\n\nContent:\n${contextForLlm}\n\nProvide a concise, accurate answer based on the above sources.`;

    // Call LLM with timing
    const aiStartTime = Date.now();
    const llmResponse = await openai.chat.completions.create({
      model: DIVE_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant for Tekir Dive mode. Provide concise, accurate answers based on web sources. Be direct and helpful. Do not use markdown, do not offer to answer a second question. Keep the answer short and understandable.',
        },
        {
          role: 'user',
          content: llmPrompt,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const aiDuration = Date.now() - aiStartTime;
    const totalDuration = Date.now() - startTime;

    const answer = llmResponse.choices[0].message.content ?? '';
    const actualModel = llmResponse.model || DIVE_MODEL;
    const usage = llmResponse.usage;

    // Update wide event with AI context
    wideEvent.setAI({
      model: 'dive',
      query_length: query.length,
      response_length: answer.length,
      estimated_tokens: usage?.total_tokens,
      is_dive_mode: true,
      providers_used: [DIVE_PROVIDER],
      sources_count: validPages.length,
    });
    wideEvent.setCustom('ai_duration_ms', aiDuration);
    wideEvent.setCustom('actual_model', actualModel);
    wideEvent.finish(200);

    // Track with native PostHog LLM analytics
    trackLLMGeneration({
      $ai_provider: DIVE_PROVIDER,
      $ai_model: actualModel,
      $ai_input: llmPrompt.substring(0, 1000) + '...', // Truncate for logging
      $ai_output: answer,
      $ai_latency: aiDuration,
      $ai_tokens_input: usage?.prompt_tokens,
      $ai_tokens_output: usage?.completion_tokens,
      $ai_tokens_total: usage?.total_tokens,
      $ai_trace_id: traceId,
      $ai_temperature: 0.3,
      $ai_max_tokens: 400,
    });

    const jsonResponse = NextResponse.json({
      response: answer || "The AI could not generate a response based on the provided content.",
      sources: validPages.map(p => ({ url: p.url, title: p.title, description: p.snippet })),
      metadata: {
        totalDuration,
        fetchDuration,
        aiDuration,
        pagesAttempted: pages.length,
        pagesSuccessful: validPages.length,
        trace_id: traceId,
      }
    });

    // Flush analytics events
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return jsonResponse;

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;

    wideEvent.setError({
      type: error.name || 'DiveError',
      message: error.message || 'Dive request failed',
      code: 'dive_error',
      domain: 'upstream_api',
    });
    wideEvent.finish(500);

    trackServerAIError({
      model: 'dive',
      error_type: error.name || 'DiveError',
      is_dive_mode: true,
    });
    flushServerEvents().catch((err) => console.warn('[PostHog] Failed to flush events:', err));

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
