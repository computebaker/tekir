// Remove all in-memory cache logic

import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import { generateText, streamText } from 'ai';
import { getConvexClient } from '@/lib/convex-client';
import { api } from '@/convex/_generated/api';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://tekir.co',
    'X-Title': 'Tekir Search',
  },
});

const generationConfig = {
  temperature: 0,
  top_p: 0.95,
  max_tokens: 300,
  reasoning: {
    exclude: true,
  },
};

async function gemini(message: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'google/gemini-2.5-flash-lite',
    ...generationConfig,
    messages: [
      {
        role: 'system',
        content:
          'You are Karakulak, a helpful AI agent working with Tekir search engine. You will receive some questions and try to answer them in a short paragraph. Make sure that you state facts. If you can\'t or don\'t want to answer a question, if you think it is against your Terms of Service, if you think that the searched term is not a question or if you can\'t find information on the question or you don\'t understand it, return an empty response.',
      },
      {
        role: 'user',
        content: message,
      },
    ],
    stream: false,
  });

  const answer = response.choices[0].message.content;
  return answer ?? "";
}

async function llama(message: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'meta-llama/llama-4-maverick',
    ...generationConfig,
    messages: [
      {
        role: 'system',
        content:
          'You are Karakulak, a helpful AI agent working with Tekir search engine. You will receive some questions and try to answer them in a short paragraph. Make sure that you state facts. If you can\'t or don\'t want to answer a question, if you think it is against your Terms of Service, if you think that the searched term is not a question or if you can\'t find information on the question or you don\'t understand it, return an empty response.',
      },
      {
        role: 'user',
        content: message,
      },
    ],
    stream: false,
  });

  const answer = response.choices[0].message.content;
  return answer ?? "";
}

async function mistral(message: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'mistralai/mistral-small-3.2-24b-instruct',
    ...generationConfig,
    messages: [
      {
        role: 'system',
        content:
          'You are Karakulak, a helpful AI agent working with Tekir search engine. You will receive some questions and try to answer them in a short paragraph. Make sure that you state facts. If you can\'t or don\'t want to answer a question, if you think it is against your Terms of Service, if you think that the searched term is not a question or if you can\'t find information on the question or you don\'t understand it, return an empty response.',
      },
      {
        role: 'user',
        content: message,
      },
    ],
    stream: false,
  });

  const answer = response.choices[0].message.content;
  return answer ?? "";
}

async function chatgpt(message: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'openai/gpt-5-mini',
    ...generationConfig,
    messages: [
      {
        role: 'system',
        content:
          'You are Karakulak, a helpful AI agent working with Tekir search engine. You will receive some questions and try to answer them in a short paragraph. Make sure that you state facts. If you can\'t or don\'t want to answer a question, if you think it is against your Terms of Service, if you think that the searched term is not a question or if you can\'t find information on the question or you don\'t understand it, return an empty response. Sometimes, the users might provide single words like "reddit", "cat" etc., provide them with information about the string user submitted.',
      },
      {
        role: 'user',
        content: message,
      },
    ],
    stream: false,
  });

  const answer = response.choices[0].message.content;
  return answer ?? "";
}

async function grok(message: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'x-ai/grok-4-fast:free',
    ...generationConfig,
    messages: [
      {
        role: 'system',
        content:
          'You are Karakulak, a helpful AI agent working with Tekir search engine. You will receive some questions and try to answer them in a short paragraph. Make sure that you state facts. If you can\'t or don\'t want to answer a question, if you think it is against your Terms of Service, if you think that the searched term is not a question or if you can\'t find information on the question or you don\'t understand it, return an empty response. When a user query is something like "reddit" or "redis", which are single word searches, provide information about the words topic.',
      },
      {
        role: 'user',
        content: message,
      },
    ],
    stream: false,
  });

  const answer = response.choices[0].message.content;
  return answer ?? "";
}

// Using shared Convex-backed rate limiter via middleware

export async function POST(req: NextRequest, { params }: { params: Promise<{ model: string }> }) {
    // Add security headers
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    const { model } = await params;
    
    // Validate model parameter
  const validModels = ['gemini', 'llama', 'mistral', 'chatgpt', 'grok'];
    if (!validModels.includes(model.toLowerCase())) {
      return NextResponse.json({ error: `Model '${model}' is not supported` }, { status: 400, headers });
    }
    
    const rateLimitResult = await checkRateLimit(req, '/api/karakulak');
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }

  const { message } = await req.json();
  
  // Input validation
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required and must be a string.' }, { status: 400, headers });
  }
  
  // Limit message length (400 characters as per search query limit)
  if (message.length > 400) {
    return NextResponse.json({ error: 'Message too long. Maximum 400 characters allowed.' }, { status: 400, headers });
  }
  
  // Basic sanitization - remove excessive whitespace and potentially harmful characters
  const sanitizedMessage = message.trim().replace(/[\x00-\x1F\x7F]/g, '');
  
  if (!sanitizedMessage) {
    return NextResponse.json({ error: 'Message cannot be empty after sanitization.' }, { status: 400, headers });
  }

  try {
    let answer: string;
    const t0 = Date.now();
    switch (model.toLowerCase()) {
      case 'gemini':
        answer = await gemini(sanitizedMessage);
        break;
      case 'llama':
        answer = await llama(sanitizedMessage);
        break;
      case 'mistral':
        answer = await mistral(sanitizedMessage);
        break;
      case 'chatgpt':
        answer = await chatgpt(sanitizedMessage);
        break;
      case 'grok':
        answer = await grok(sanitizedMessage);
        break;
      default:
        return NextResponse.json({ error: `Model '${model}' is not supported` }, { status: 404 });
    }
    const latency = Date.now() - t0;
    // Fire-and-forget AI usage logging
    try {
      const convex = getConvexClient();
      await convex.mutation(api.usage.logAiUsage, {
        model: model.toLowerCase(),
        latencyMs: latency,
        answerChars: (answer || '').length,
      });
    } catch (e) {
      console.warn('Failed to log AI usage:', e);
    }
    return NextResponse.json({ answer }, { headers });
  } catch (error: any) {
    console.error('Error in Karakulak API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers });
  }
}