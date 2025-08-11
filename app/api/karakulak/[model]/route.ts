// Remove all in-memory cache logic

import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { generateText, streamText } from 'ai';
import { isValidSessionToken, incrementAndCheckRequestCount } from '@/lib/convex-session';

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

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(identifier);
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (current.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  current.count++;
  return true;
}

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
    const validModels = ['gemini', 'llama', 'mistral', 'chatgpt'];
    if (!validModels.includes(model.toLowerCase())) {
      return NextResponse.json({ error: `Model '${model}' is not supported` }, { status: 400, headers });
    }
    
    // Session token validation and rate limiting
    const sessionToken = req.cookies.get('session-token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Missing session token.' }, { status: 401, headers });
    }
    
    const isValid = await isValidSessionToken(sessionToken);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired session token.' }, { status: 403, headers });
    }
    
    const { allowed, currentCount } = await incrementAndCheckRequestCount(sessionToken);
    if (!allowed) {
      console.warn(`Session token ${sessionToken} exceeded request limit for /api/karakulak. Count: ${currentCount}`);
      return NextResponse.json({ 
        error: 'Request limit exceeded for this session.',
        currentCount,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, { status: 429, headers });
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
      default:
        return NextResponse.json({ error: `Model '${model}' is not supported` }, { status: 404 });
    }
    return NextResponse.json({ answer }, { headers });
  } catch (error: any) {
    console.error('Error in Karakulak API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500, headers });
  }
}